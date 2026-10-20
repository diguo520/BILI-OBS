// Never open a console window on Windows, including debug builds.
#![cfg_attr(windows, windows_subsystem = "windows")]

fn main() {
    bili_obs_lib::run()
}
