#!/usr/bin/env bash
# exit on error
set -o errexit

pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Final system check
python -c "import cv2; print('OpenCV ready')"
python -c "import numpy; print('NumPy ready')"
