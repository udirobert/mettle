import os
import sys

import modal

image = (
    modal.Image.debian_slim(python_version="3.12")
    .uv_sync(uv_project_dir="backend")
    .add_local_dir("backend", "/root/backend")
    .add_local_dir("scenarios", "/root/scenarios")
)

app = modal.App("mettle-agent", image=image)


@app.function(secrets=[modal.Secret.from_name("mettle-env")])
@modal.asgi_app(label="mettle-agent")
def web_app():
    os.environ["METTLE_ENV"] = "development"
    os.environ["CORS_ALLOWED_ORIGINS"] = "*"
    sys.path.insert(0, "/root/backend")

    from serve import app as fastapi_app

    return fastapi_app
