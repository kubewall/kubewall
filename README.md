# kubewall

[Install](https://github.com/kubewall/kubewall?tab=readme-ov-file#battery-install)
| [Guide](https://github.com/abhimanyu003/kw?tab=readme-ov-file#books-guide)
| [Releases](https://github.com/kubewall/kubewall/releases)
| [Source Code](https://github.com/kubewall/kubewall)

A single binary to manage your multiple kubernetes clusters.

**kubewall** provides simplify and rich real time interface to manage and investigate your clusters.


**Key features of KubeWall include:**

* **Single binary deployment:** KubeWall can be easily deployed as a single binary, eliminating the need for complex configurations.
* **Browser-based access:** KubeWall can be accessed directly from your favorite web browser, providing a seamless user experience.
* **Real-time cluster monitoring:** KubeWall offers a rich, real-time interface that displays the current state of your Kubernetes clusters, allowing you to quickly identify and address issues.
* **Cluster management:** KubeWall enables you to manage multiple Kubernetes clusters from a single pane of glass, reducing the overhead of switching between different tools and interfaces.
* **Detailed cluster insights:** KubeWall provides comprehensive insights into your Kubernetes clusters, manifest info of your pods, services, config and others.

# :movie_camera: Into

![kubewall](/media/readme.png)

> [!Important]
> Please keep in mind that kubewall is still under active development.
> 
> When not used over HTTP/2, SSE suffers from a limitation to the maximum number of open connections, which can be especially painful when opening multiple tabs, as the limit is per browser and is set to a very low number (6). We suggest to use HTTPS

# :battery: Install

#### Docker

```shell
docker run -p 7080:7080 -v kubewall:/.kubewall ghcr.io/kubewall/kubewall:latest
```

> To access local kind cluster you can use "--network host" docker flag.

#### Homebrew

```shell
brew install kubewall/tap/kubewall
```

#### Snap

```shell
sudo snap install kubewall
```

#### Arch Linux

```shell
yay -S kubewall-bin
```

#### Scoop

```shell
scoop bucket add kubewall https://github.com/kubewall/scoop-bucket.git
scoop install kubewall
```

#### Binary

**MacOS**
[Binary](https://github.com/kubewall/kubewall/releases/latest/download/kubewall_Darwin_all.tar.gz) ( Multi-Architecture )

**Linux (Binaries)**
[amd64](https://github.com/kubewall/kubewall/releases/latest/download/kubewall_Linux_x86_64.tar.gz) | [arm64](https://github.com/kubewall/kubewall/releases/latest/download/kubewall_Linux_arm64.tar.gz) | [i386](https://github.com/kubewall/kubewall/releases/latest/download/kubewall_Linux_i386.tar.gz)

**Windows (Exe)**
[amd64](https://github.com/kubewall/kubewall/releases/latest/download/kubewall_Windows_x86_64.zip) | [arm64](https://github.com/kubewall/kubewall/releases/latest/download/kubewall_Windows_arm64.zip) | [i386](https://github.com/kubewall/kubewall/releases/latest/download/kubewall_Windows_i386.zip)

**FreeBSD (Binaries)**
[amd64](https://github.com/kubewall/kubewall/releases/latest/download/kubewall_Freebsd_x86_64.tar.gz) | [arm64](https://github.com/kubewall/kubewall/releases/latest/download/kubewall_Freebsd_arm64.tar.gz) | [i386](https://github.com/kubewall/kubewall/releases/latest/download/kubewall_Freebsd_i386.tar.gz)

Manually
Download the pre-compiled binaries from the [Release!](https://github.com/kubewall/kubewall/releases) page and copy them to the desired location or system path.

# :books: Guide

### Flags

Since kubewall runs as binary there are few of flag you can use.

```shell
> kubewall --help

Usage:
  kubewall [flags]
  kubewall [command]

Available Commands:
  completion  Generate the autocompletion script for the specified shell
  help        Help about any command
  version     Print the version of kubewall

Flags:
      --certFile string        absolute path to certificate file
  -h, --help                   help for kubewall
      --k8s-client-burst int   Maximum burst for throttle (default 50)
      --k8s-client-qps int     maximum QPS to the master from client (default 50)
      --keyFile string         absolute path to key file
  -p, --port string            port to listen on (default ":7080")

Use "kubewall [command] --help" for more information about a command.
```

### Setting up HTTPS locally

You can use your own certificates or create new local trusted certificates using [mkcert](https://github.com/FiloSottile/mkcert).

> [!Important]
> You'll need to install [mkcert](https://github.com/FiloSottile/mkcert) separately.

1. Install mkcert on your computer.
2. Run the following command in your terminal or command prompt:

`mkcert kubewall.test localhost 127.0.0.1 ::1`

3. This command will generate two files: a certificate file and a key file (the key file will have `-key.pem` at the end of its name).
4. To use these files with kubewall, use `--certFile=` and `--keyFile=` flags

```shell
kubewall --certFile=kubewall.test+3.pem --keyFile=kubewall.test+3-key.pem
```

**When using Docker**

When using Docker, you can attach volumes and provide certificates by using specific flags.
In the example below, we are attaching the current directory on your host to the `/.certs` directory inside the Docker container:

```shell
docker run -p 7080:7080 \
    -v kubewall:/.kubewall \
    -v $(pwd):/.certs \
    ghcr.io/kubewall/kubewall:latest \
    --certFile=/.certs/kubewall.test+3.pem \
    --keyFile=/.certs/kubewall.test+3-key.pem
```

### Custom Port

Yon can run kubewall on any port you like. by using `-p` or `--port` flag

```shell
kubewall -p 7080
```

# :man_technologist: Developers


<p float="left">
   <picture width="49%">
      <source media="(prefers-color-scheme: dark)" srcset="./media/Abhimanyu-Dark.png" width="49%">
      <source media="(prefers-color-scheme: light)" srcset="./media/Abhimanyu-Light.png" width="49%">
      <img src="./media/Abhimanyu-Light.png" width="49%">
   </picture>
   <picture width="49%">
      <source media="(prefers-color-scheme: dark)" srcset="./media/Kshitij-Dark.png" width="49%">
      <source media="(prefers-color-scheme: light)" srcset="./media/Kshitij-Light.png" width="49%">
      <img src="./media/Abhimanyu-Light.png" width="49%">
   </picture>
   <a target="_blank" href="https://github.com/abhimanyu003">
      <picture width="49%">
         <source media="(prefers-color-scheme: dark)" srcset="./media/Github-Dark.png" width="49%">
         <source media="(prefers-color-scheme: light)" srcset="./media/Github-Light.png" width="49%">
         <img src="./media/Github-Light.png" width="49%">
      </picture>
   </a>
   <a target="_blank" href="https://github.com/kshitijmehta">
      <picture width="49%">
         <source media="(prefers-color-scheme: dark)" srcset="./media/Github-Dark.png" width="49%">
         <source media="(prefers-color-scheme: light)" srcset="./media/Github-Light.png" width="49%">
         <img src="./media/Github-Light.png" width="49%">
      </picture>
   </a>
   <a target="_blank" href="https://x.com/abhimanyu003">
      <picture width="49%">
         <source media="(prefers-color-scheme: dark)" srcset="./media/Twitter-Dark.png" width="49%">
         <source media="(prefers-color-scheme: light)" srcset="./media/Twitter-Light.png" width="49%">
         <img src="./media/Twitter-Light.png" width="49%">
      </picture>
   </a>
   <a target="_blank" href="https://x.com/kshitijjazz">
      <picture width="49%">
         <source media="(prefers-color-scheme: dark)" srcset="./media/Twitter-Dark.png" width="49%">
         <source media="(prefers-color-scheme: light)" srcset="./media/Twitter-Light.png" width="49%">
         <img src="./media/Twitter-Light.png" width="49%">
      </picture>
   </a>
   <a target="_blank" href="https://www.linkedin.com/in/abhimanyu003/">
      <picture width="49%">
         <source media="(prefers-color-scheme: dark)" srcset="./media/LinkedIn-Dark.png" width="49%">
         <source media="(prefers-color-scheme: light)" srcset="./media/LinkedIn-Light.png" width="49%">
         <img src="./media/LinkedIn-Light.png" width="49%">
      </picture>
   </a>
   <a target="_blank" href="https://www.linkedin.com/in/kshitijkmehta/">
      <picture width="49%">
         <source media="(prefers-color-scheme: dark)" srcset="./media/LinkedIn-Dark.png" width="49%">
         <source media="(prefers-color-scheme: light)" srcset="./media/LinkedIn-Light.png" width="49%">
         <img src="./media/LinkedIn-Light.png" width="49%">
      </picture>
   </a>
</p>

# Contribution

This project welcomes your PR and issues. For example, refactoring, adding features, correcting English, etc.

If you need any help, you can contact us from the above Developers sections.

Thanks to all the people who already contributed and using the project.


# License

kubewall is licensed under [Apache License, Version 2.0](./LICENSE)