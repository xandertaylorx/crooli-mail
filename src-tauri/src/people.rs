//! Sender pictures and contact suggestions.
//!
//! Pictures: a person's Gravatar first, then the company's own logo from the sender's
//! website (apple-touch-icon, the icon the homepage declares, or favicon.ico). Nothing
//! goes through a third-party logo service. Results, including misses, are cached on disk.
//!
//! Contacts: everyone in the cached mail for an account, ranked by how often they appear.

use base64::Engine;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::io::Read;
use std::path::PathBuf;
use std::time::Duration;

const MAX_ICON: u64 = 400_000;

/// Free-mail domains: their logo would be Gmail's or Apple's, not the sender's.
const PERSONAL: &[&str] = &[
    "gmail.com", "googlemail.com", "icloud.com", "me.com", "mac.com", "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com",
    "msn.com", "yahoo.com", "yahoo.co.uk", "ymail.com", "aol.com", "proton.me", "protonmail.com", "pm.me", "fastmail.com",
    "gmx.com", "gmx.de", "zoho.com", "hey.com", "mail.com", "btinternet.com", "sky.com", "virginmedia.com",
];

fn icon_dir() -> PathBuf {
    let d = dirs::cache_dir().unwrap_or_else(std::env::temp_dir).join("com.crooli.mail").join("icons");
    let _ = std::fs::create_dir_all(&d);
    d
}

fn sha(s: &str) -> String {
    Sha256::digest(s.as_bytes()).iter().map(|b| format!("{b:02x}")).collect()
}

/// mail.notion.so -> notion.so, news.bbc.co.uk -> bbc.co.uk
fn root_domain(host: &str) -> String {
    let labels: Vec<&str> = host.trim_end_matches('.').split('.').collect();
    if labels.len() <= 2 {
        return host.to_string();
    }
    let n = labels.len();
    let sld = labels[n - 2];
    let keep = if labels[n - 1].len() == 2 && ["co", "com", "org", "net", "ac", "gov", "edu", "ltd", "plc"].contains(&sld) { 3 } else { 2 };
    labels[n.saturating_sub(keep)..].join(".")
}

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(4))
        .timeout(Duration::from_secs(7))
        .redirects(4)
        .user_agent("CrooliMail/0.2 (+https://mail.crooli.com)")
        .build()
}

/// Fetches an image, returning (mime, bytes) if it really is a reasonably sized image.
fn fetch_image(a: &ureq::Agent, url: &str) -> Option<(String, Vec<u8>)> {
    let r = a.get(url).call().ok()?;
    let mut mime = r.content_type().to_lowercase();
    let mut buf = Vec::new();
    r.into_reader().take(MAX_ICON + 1).read_to_end(&mut buf).ok()?;
    if buf.len() < 64 || buf.len() as u64 > MAX_ICON {
        return None;
    }
    // Some servers send icons as text/plain or octet-stream: sniff the bytes.
    if !mime.starts_with("image/") {
        mime = match &buf[..4] {
            [0x89, b'P', b'N', b'G'] => "image/png".into(),
            [0xFF, 0xD8, _, _] => "image/jpeg".into(),
            [0, 0, 1, 0] => "image/x-icon".into(),
            [b'G', b'I', b'F', _] => "image/gif".into(),
            _ if buf.starts_with(b"<svg") || buf.starts_with(b"<?xml") => "image/svg+xml".into(),
            _ => return None,
        };
    }
    Some((mime, buf))
}

/// Icon links declared in a homepage, best first (apple-touch-icon, then larger sizes).
fn declared_icons(html: &str, base: &str) -> Vec<String> {
    let lower = html.to_lowercase();
    let mut found: Vec<(i32, String)> = Vec::new();
    let mut i = 0;
    while let Some(p) = lower[i..].find("<link") {
        let start = i + p;
        let end = lower[start..].find('>').map(|e| start + e).unwrap_or(lower.len());
        let tag = &html[start..end];
        let ltag = &lower[start..end];
        i = end;
        if !ltag.contains("icon") {
            continue;
        }
        let attr = |name: &str| -> Option<String> {
            let k = ltag.find(&format!("{name}="))? + name.len() + 1;
            let rest = &tag[k..];
            let q = rest.chars().next()?;
            if q == '"' || q == '\'' {
                rest[1..].find(q).map(|e| rest[1..1 + e].to_string())
            } else {
                Some(rest.split_whitespace().next()?.to_string())
            }
        };
        let Some(href) = attr("href") else { continue };
        let rel = attr("rel").unwrap_or_default().to_lowercase();
        let size: i32 = attr("sizes").and_then(|s| s.split('x').next().and_then(|n| n.parse().ok())).unwrap_or(32);
        let score = if rel.contains("apple-touch") { 1000 } else { 0 } + size.min(512);
        let url = if href.starts_with("http") {
            href
        } else if let Some(h) = href.strip_prefix("//") {
            format!("https://{h}")
        } else if href.starts_with('/') {
            format!("{base}{href}")
        } else {
            format!("{base}/{href}")
        };
        if url.starts_with("https://") {
            found.push((score, url));
        }
    }
    found.sort_by_key(|x| std::cmp::Reverse(x.0));
    found.into_iter().map(|x| x.1).collect()
}

fn company_logo(a: &ureq::Agent, domain: &str) -> Option<(String, Vec<u8>)> {
    for host in [domain.to_string(), format!("www.{domain}")] {
        let base = format!("https://{host}");
        if let Some(img) = fetch_image(a, &format!("{base}/apple-touch-icon.png")) {
            return Some(img);
        }
        if let Ok(r) = a.get(&format!("{base}/")).call() {
            let mut html = String::new();
            let _ = r.into_reader().take(400_000).read_to_string(&mut html);
            for url in declared_icons(&html, &base).into_iter().take(3) {
                if let Some(img) = fetch_image(a, &url) {
                    return Some(img);
                }
            }
        }
        if let Some(img) = fetch_image(a, &format!("{base}/favicon.ico")) {
            return Some(img);
        }
    }
    None
}

fn data_url((mime, bytes): &(String, Vec<u8>)) -> String {
    format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes))
}

fn cached(key: &str, make: impl FnOnce() -> Option<(String, Vec<u8>)>) -> Option<String> {
    let path = icon_dir().join(sha(key));
    if let Ok(s) = std::fs::read_to_string(&path) {
        return if s.is_empty() { None } else { Some(s) };
    }
    let url = make().map(|img| data_url(&img));
    let _ = std::fs::write(&path, url.as_deref().unwrap_or(""));
    url
}

/// A picture for this sender as a data URL, or nothing (show initials).
#[tauri::command]
pub async fn sender_icon(address: String) -> Option<String> {
    tauri::async_runtime::spawn_blocking(move || {
        let address = address.trim().to_lowercase();
        let domain = address.split('@').nth(1)?.to_string();
        let a = agent();
        let person = cached(&format!("gravatar:{address}"), || {
            fetch_image(&a, &format!("https://gravatar.com/avatar/{}?s=128&d=404", sha(&address)))
        });
        if person.is_some() || PERSONAL.contains(&domain.as_str()) {
            return person;
        }
        let root = root_domain(&domain);
        cached(&format!("logo:{root}"), || company_logo(&a, &root))
    })
    .await
    .ok()
    .flatten()
}

#[derive(Serialize)]
pub struct Contact {
    name: String,
    address: String,
    count: u32,
}

/// Everyone in this account's cached mail, most frequent first. Senders who look like
/// robots (no-reply addresses) are left out, since you never write to them.
#[tauri::command]
pub fn contacts(email: String) -> Vec<Contact> {
    let mut map: HashMap<String, (String, u32)> = HashMap::new();
    let mut add = |name: &str, addr: &str, weight: u32| {
        let a = addr.trim().to_lowercase();
        if !a.contains('@') || a == email || ["noreply", "no-reply", "donotreply", "do-not-reply", "notifications@", "mailer-daemon"].iter().any(|x| a.contains(x)) {
            return;
        }
        let e = map.entry(a).or_insert_with(|| (String::new(), 0));
        if e.0.is_empty() && !name.trim().is_empty() && !name.contains('@') {
            e.0 = name.trim().trim_matches('"').to_string();
        }
        e.1 += weight;
    };
    for folder in ["inbox", "sent", "archive", "starred", "drafts"] {
        for h in crate::mail::cached_headers(&email, folder) {
            if folder == "sent" || folder == "drafts" {
                // People you write to matter most.
                for (n, a) in h.to_names.split(", ").zip(h.to_addresses.split(", ")) {
                    add(n, a, 3);
                }
            } else {
                add(&h.from_name, &h.from_address, 1);
            }
        }
    }
    let mut out: Vec<Contact> = map.into_iter().map(|(address, (name, count))| Contact { name, address, count }).collect();
    out.sort_by_key(|c| std::cmp::Reverse(c.count));
    out.truncate(2000);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roots() {
        assert_eq!(root_domain("mail.notion.so"), "notion.so");
        assert_eq!(root_domain("news.bbc.co.uk"), "bbc.co.uk");
        assert_eq!(root_domain("github.com"), "github.com");
    }

    #[test]
    fn icon_links() {
        let html = r#"<link rel="icon" href="/fav.png" sizes="32x32"><link rel="apple-touch-icon" href="https://x.com/a.png">"#;
        assert_eq!(declared_icons(html, "https://x.com"), vec!["https://x.com/a.png", "https://x.com/fav.png"]);
    }

    #[test]
    #[ignore]
    fn live_logos() {
        let a = agent();
        for d in ["github.com", "stripe.com", "deel.com", "substack.com"] {
            let r = company_logo(&a, d);
            println!("{d}: {:?}", r.as_ref().map(|(m, b)| (m.clone(), b.len())));
            assert!(r.is_some(), "{d}");
        }
    }
}
