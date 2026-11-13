mod agent;
mod mail;
mod people;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            agent::detect_agents,
            agent::run_agent,
            agent::cancel_agent,
            mail::list_accounts,
            mail::connect_account,
            mail::remove_account,
            mail::cached_folder,
            mail::sync_folder_cmd,
            mail::get_message,
            mail::set_flag,
            mail::move_message,
            mail::send_message,
            mail::save_draft,
            mail::open_url,
            people::sender_icon,
            people::contacts
        ])
        .run(tauri::generate_context!())
        .expect("error while running Crooli Mail");
}
