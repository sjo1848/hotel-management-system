use hms_backend::infrastructure::web::passwords::hash_password;
use std::env;

fn main() {
    let password = env::args()
        .nth(1)
        .expect("usage: cargo run --bin hash_password -- <password>");

    let hash = hash_password(&password).expect("failed to hash password");
    println!("{hash}");
}
