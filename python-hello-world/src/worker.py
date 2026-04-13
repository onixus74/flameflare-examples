def on_fetch(request, env):
    """Handle incoming HTTP requests."""
    path = request.get("url", "/")
    return {
        "status": 200,
        "headers": {"content-type": "text/plain"},
        "body": f"Hello from Python! Path: {path}"
    }