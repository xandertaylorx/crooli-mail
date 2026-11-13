mod agent;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![agent::detect_agents, agent::run_agent, agent::cancel_agent])
        .run(tauri::generate_context!())
        .expect("error while running Crooli Mail");
}
