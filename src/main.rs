use axum::{http::HeaderValue, Router};
use std::net::SocketAddr;
use tower_http::{
    services::{ServeDir, ServeFile},
    set_header::SetResponseHeaderLayer,
};

#[tokio::main]
async fn main() {
    // 1. Point to where the SvelteKit static files will live
    let frontend_dir = "frontend/build";
    
    // 2. Set up the static file server with a fallback to index.html
    let serve_dir = ServeDir::new(frontend_dir)
        .not_found_service(ServeFile::new(format!("{}/index.html", frontend_dir)));

    // 3. Create the router and inject the crucial WebAssembly Audio headers
    let app = Router::new()
        .fallback_service(serve_dir)
        // Cross-Origin-Opener-Policy
        .layer(SetResponseHeaderLayer::overriding(
            axum::http::header::HeaderName::from_static("cross-origin-opener-policy"),
            HeaderValue::from_static("same-origin"),
        ))
        // Cross-Origin-Embedder-Policy (Allows SharedArrayBuffer for low-latency audio)
        .layer(SetResponseHeaderLayer::overriding(
            axum::http::header::HeaderName::from_static("cross-origin-embedder-policy"),
            HeaderValue::from_static("require-corp"),
        ));

    // 4. Start the server
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Backend running on http://{}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}