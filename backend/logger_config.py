import logging
import os
from logging.handlers import RotatingFileHandler

# Create logs folder automatically
if not os.path.exists("logs"):
    os.makedirs("logs")

# Logger object
logger = logging.getLogger("sms_app")

logger.setLevel(logging.INFO)

# Format
formatter = logging.Formatter(
    "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# File Handler
file_handler = RotatingFileHandler(
    "logs/app.log",
    maxBytes=5 * 1024 * 1024,
    backupCount=5
)

file_handler.setFormatter(formatter)

# Console Handler
console_handler = logging.StreamHandler()
console_handler.setFormatter(formatter)

# Add handlers
logger.addHandler(file_handler)
logger.addHandler(console_handler)