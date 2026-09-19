"""Loads custom_components/kanban/api.py directly, bypassing the package's
__init__.py (which imports Home Assistant core — not a dependency we want for
these lightweight, homeassistant-free unit tests of the REST client).
"""

import importlib.util
import sys
from pathlib import Path

_API_PATH = Path(__file__).parent.parent / "custom_components" / "kanban" / "api.py"
_spec = importlib.util.spec_from_file_location("kanban_api", _API_PATH)
_module = importlib.util.module_from_spec(_spec)
sys.modules["kanban_api"] = _module
_spec.loader.exec_module(_module)
