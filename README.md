# MergeRequestsCI

> UI to see all GitLab merge requests of your teams in one place.

![MergeRequestsCI](screenshot.png)

## Requirements

* [GitLab](https://about.gitlab.com/) >= 8.4

## Installation

### Clone the project

```bash
> git clone https://github.com/Hexanet/MergeRequestsCI.git
> cd MergeRequestsCI
```

### Install dependencies

```bash
> npm install
```

## Configuration

Please configure a new `app/config/app.yaml` file from [`app/config/app.yaml.dist`](app/config/app.yaml.dist).

Options :

* **refreshInterval** : time in seconds between 2 dashboard updates
* **apiUrl** : url of your GitLab API
* **token** : private token for API calls

## Run the server

After configuration, you have to build the code and launch the server.

```bash
> npm run serve
```

Then open `http://localhost:3000` in your browser.

## Credits

Developed by the [Web Team](https://twitter.com/hexanetweb) of [Hexanet](http://www.hexanet.fr/).

### Inspiration

Thanks [M6Web](https://github.com/M6Web) ([Github Team Reviewer](https://github.com/M6Web/GithubTeamReviewer)) and [Jean-François Lépine](http://blog.lepine.pro/) ([Taylorisme de la qualité logicielle](http://slides.com/halleck/taylorisme-de-la-qualite-logicielle)).

## License

[MergeRequestsCI](https://github.com/Hexanet/MergeRequestsCI) is licensed under the [MIT license](LICENSE).
