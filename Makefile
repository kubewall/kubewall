# Build go binary.
build-go:
	cd ./backend && go build *.go

run:
	cd ./backend && go run *.go -p 2121