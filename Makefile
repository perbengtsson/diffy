.PHONY: install build

install: build
	npm link

build:
	npm install
	npm run build
