const axios = require("axios").default;

class tmdbService {
	constructor() {
		this.tmdbApi = axios.create({
			baseURL: "https://api.themoviedb.org/4",
		});
		this.apiKey = process.env.TMDB_API_KEY;
	}

	async searchMovie(searchTerm) {
        let response = await this.tmdbApi.get(
			`/search/movie?api_key=${this.apiKey}&query=${searchTerm}&language=pt-BR`
		);
        return response.status == 200 ? response.data.results : null;
	}
}

module.exports.tmdbService = new tmdbService();
