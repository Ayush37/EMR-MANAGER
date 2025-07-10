.PHONY: build run test lint clean package wheel

# Python interpreter
PYTHON := python3
PIP := pip3

# Virtual environment
VENV := venv
VENV_ACTIVATE := . $(VENV)/bin/activate

# Application name
APP_NAME := ssm-backend

build:
	@echo "Setting up virtual environment..."
	$(PYTHON) -m venv $(VENV)
	$(VENV_ACTIVATE) && $(PIP) install --upgrade pip
	$(VENV_ACTIVATE) && $(PIP) install -r requirements.txt
	@echo "Build complete!"

run:
	@echo "Starting SSM Backend service..."
	$(VENV_ACTIVATE) && $(PYTHON) app.py

test:
	@echo "Running tests..."
	$(VENV_ACTIVATE) && $(PIP) install pytest pytest-cov
	$(VENV_ACTIVATE) && pytest -v --cov=app tests/

lint:
	@echo "Running linting..."
	$(VENV_ACTIVATE) && $(PIP) install ruff
	$(VENV_ACTIVATE) && ruff check app.py
	$(VENV_ACTIVATE) && ruff format app.py --check

format:
	@echo "Formatting code..."
	$(VENV_ACTIVATE) && $(PIP) install ruff
	$(VENV_ACTIVATE) && ruff format app.py

clean:
	@echo "Cleaning up..."
	rm -rf $(VENV)
	rm -rf __pycache__
	rm -rf *.pyc
	rm -rf .coverage
	rm -rf htmlcov
	rm -rf .pytest_cache
	rm -rf dist
	rm -rf build
	rm -rf *.egg-info
	find . -type d -name "__pycache__" -exec rm -rf {} +

package: clean build
	@echo "Creating deployment package..."
	mkdir -p dist
	cp -r $(VENV)/lib/python*/site-packages/* dist/
	cp app.py dist/
	cd dist && zip -r ../$(APP_NAME).zip .
	rm -rf dist
	@echo "Package created: $(APP_NAME).zip"

wheel:
	@echo "Building wheel package..."
	$(VENV_ACTIVATE) && $(PIP) install wheel setuptools
	$(VENV_ACTIVATE) && $(PYTHON) setup.py bdist_wheel

install-dev:
	@echo "Installing development dependencies..."
	$(VENV_ACTIVATE) && $(PIP) install pytest pytest-cov ruff

help:
	@echo "Available commands:"
	@echo "  make build       - Set up virtual environment and install dependencies"
	@echo "  make run         - Run the Flask application"
	@echo "  make test        - Run tests"
	@echo "  make lint        - Run code linting"
	@echo "  make format      - Format code"
	@echo "  make clean       - Remove build artifacts"
	@echo "  make package     - Create deployment package"
	@echo "  make wheel       - Build wheel package"
	@echo "  make install-dev - Install development dependencies"