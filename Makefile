.PHONY: dev private private-en build pdf pdf-private pdf-private-en test clean

dev:
	npm run dev

private:
	npm run dev:private

private-en:
	npm run dev:private:en

build:
	npm run build

pdf:
	npm run pdf

pdf-private:
	npm run pdf:private

pdf-private-en:
	npm run pdf:private:en

test:
	npm test

clean:
	npm run clean
