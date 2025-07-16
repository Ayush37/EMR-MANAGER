POETRY_VERSION=2.1.3
POETRY_PLUGIN_SHELL_VERSION=1.0.1
POETRY_PLUGIN_EXPORT_VERSION=1.9.0
DIST_DIR := dist
LOGS_DIR := logs
APP_NAME := s3data-viewer
VERSION := 0.1.0

.PHONY: all
.DEFAULT_GOAL=help

.PHONY: clean
clean: ## Remove all cache, reports, coverage, distribution files and folders
	rm -f .coverage
	rm -f requirements.txt
	rm -rf .pytest_cache
	rm -rf $(DIST_DIR)
	rm -rf reports
	rm -rf build
	rm -rf *.egg-info
	find . -name "*.pyc" -delete
	find . -name "__pycache__" -delete

.PHONY: distclean
distclean: clean ## Remove all build and test artifacts and the virtual environment
	rm -rf .venv
	rm -rf $(LOGS_DIR)

.PHONY: setup
setup: ## Set up the project structure and directories
	mkdir -p $(LOGS_DIR)

.PHONY: create-pyproject
create-pyproject: ## Create pyproject.toml file for Poetry
	@echo "Creating pyproject.toml file"
	@echo "[tool.poetry]" > pyproject.toml
	@echo "name = \"$(APP_NAME)\"" >> pyproject.toml
	@echo "version = \"$(VERSION)\"" >> pyproject.toml
	@echo "description = \"SSM Parameter Manager Flask Application\"" >> pyproject.toml
	@echo "authors = [\"Your Name <your.email@example.com>\"]" >> pyproject.toml
	@echo "" >> pyproject.toml
	@echo "[tool.poetry.dependencies]" >> pyproject.toml
	@echo "python = \"^3.7\"" >> pyproject.toml
	@echo "flask = \"^2.2.3\"" >> pyproject.toml
	@echo "flask-cors = \"^3.0.10\"" >> pyproject.toml
	@echo "boto3 = \"^1.26.84\"" >> pyproject.toml
	@echo "python-dotenv = \"^1.0.0\"" >> pyproject.toml
	@echo "waitress = \"^2.1.2\"" >> pyproject.toml
	@echo "" >> pyproject.toml
	@echo "[tool.poetry.dev-dependencies]" >> pyproject.toml
	@echo "pytest = \"^7.0.0\"" >> pyproject.toml
	@echo "ruff = \"^0.0.262\"" >> pyproject.toml
	@echo "" >> pyproject.toml
	@echo "[build-system]" >> pyproject.toml
	@echo "requires = [\"poetry-core>=1.0.0\"]" >> pyproject.toml
	@echo "build-backend = \"poetry.core.masonry.api\"" >> pyproject.toml

.PHONY: build
build: ## Create the virtual environment and install dependencies
	python -m pip install --upgrade pip
	pip install poetry==$(POETRY_VERSION)
	poetry install --no-root

.PHONY: update
update: ## Update dependencies
	python -m poetry update

.PHONY: requirements
requirements: ## Generate requirements.txt for Docker
	@echo "Generating requirements.txt"
	pip freeze > requirements.txt

.PHONY: setup-py
setup-py: ## Create setup.py file required for building wheel
	@echo "Creating setup.py file"
	@echo "from setuptools import setup, find_packages" > setup.py
	@echo "setup(" >> setup.py
	@echo "    name=\"$(APP_NAME)\"," >> setup.py
	@echo "    version=\"$(VERSION)\"," >> setup.py
	@echo "    packages=find_packages()," >> setup.py
	@echo "    py_modules=[\"app\"]," >> setup.py
	@echo "    include_package_data=True," >> setup.py
	@echo "    install_requires=[" >> setup.py
	@echo "        \"flask==2.2.3\"," >> setup.py
	@echo "        \"flask-cors==3.0.10\"," >> setup.py
	@echo "        \"boto3==1.26.84\"," >> setup.py
	@echo "        \"python-dotenv==1.0.0\"," >> setup.py
	@echo "        \"waitress==2.1.2\"," >> setup.py
	@echo "        \"Werkzeug==2.3.7\"," >> setup.py
	@echo "        \"pyarrow==20.0.0\"," >> setup.py
	@echo "        \"openai==1.35.3\"," >> setup.py
	@echo "        \"azure-identity==1.16.0\"," >> setup.py
	@echo "    ]," >> setup.py
	@echo "    python_requires=\">=3.9\"," >> setup.py
	@echo ")" >> setup.py

.PHONY: wheel
wheel: setup-py ## Create wheel package using setuptools
	@echo "Building wheel package"
	pip install wheel
	python setup.py bdist_wheel
	@echo "Wheel package created in $(DIST_DIR) directory"

.PHONY: test
test: ## Execute test cases
	poetry run pytest

.PHONY: lint
lint: ## Lint all files
	poetry run ruff check .

.PHONY: format
format: ## Formats the Python Files
	poetry run ruff format .

.PHONY: package
package: clean requirements wheel ## Create deployable wheel package

.PHONY: run
run: setup ## Run the Flask application with Waitress
	python app.py

.PHONY: ci
ci: clean setup build package ## Runs clean, setup, build, and package

.PHONY: help
help: ## Show make target documentation
	@awk -F ':.*##' '/^[a-zA-Z_-]+:.*##/ { \
		printf "\033[36m%-30s\033[0m %s\n", $$1, $$2 \
	}' $(MAKEFILE_LIST)