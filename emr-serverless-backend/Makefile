.PHONY: clean build run test package

clean:
	rm -rf build dist *.egg-info

build: requirements.txt
	pip install -r requirements.txt

run:
	URL_PREFIX="" python app.py

test:
	python -m pytest tests/

lint:
	python -m flake8 . --max-line-length=120

package: clean
	python -m build

ci: clean package