import os


try:
    from config_local import AMAP_JS_KEY, AMAP_SECURITY_CODE, AMAP_WEB_KEY
except ImportError:
    AMAP_JS_KEY = ""
    AMAP_SECURITY_CODE = ""
    AMAP_WEB_KEY = ""


def get_setting(name, default=""):
    return os.getenv(name) or globals().get(name, default)
