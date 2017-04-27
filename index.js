const request = require("request");

var osu = function (api_key) {
	if (!(this instanceof osu)) {
		return new osu(api_key);
	}
	if (!api_key) {
		throw new Error("Please supply an API key. See https://osu.ppy.sh/p/api for details.");
	}
	this.api_key = api_key;
	this.base_url = "https://osu.ppy.sh/api";

	this.api_call = function (url, options) {
		return new Promise(function (resolve) {
			options["k"] = this.api_key;
			var payload = {
				"baseUrl": this.base_url,
				"method": "GET",
				"qs": options,
				"url": url,
			};
			request(payload, function (error, response, body) {
				if (error) {
					throw new Error("API '" + url + "' failed. Error: " + error.toString());
				}
				var result = JSON.parse(body);
				resolve(result);
			});
		});
	};

	this.get_beatmaps = function (options) {
		return new Promise(function (resolve) {
			this.api_call("/get_beatmaps", options).then(function (result) {
				resolve(result);
			});
		});
	};

	this.get_user = function (options) {
		return new Promise(function (resolve) {
			this.api_call("/get_user", options).then(function (result) {
				resolve(result);
			});
		});
	};

	this.get_scores = function (options) {
		return new Promise(function (resolve) {
			this.api_call("/get_scores", options, function (result) {
				resolve(result);
			});
		});
	};

	this.get_user_best = function (options) {
		return new Promise(function (resolve) {
			this.api_call("/get_user_best", options).then(function (result) {
				resolve(result);
			});
		});
	};

	this.get_user_recent = function (options) {
		return new Promise(function (resolve) {
			this.api_call("/get_user_recent", options).then(function (result) {
				resolve(result);
			});
		});
	};

	this.get_match = function (options) {
		return new Promise(function (resolve) {
			this.api_call("/get_match", options).then(function (result) {
				resolve(result);
			});
		});
	};

	this.get_replay = function (options) {
		return new Promise(function (resolve) {
			this.api_call("/get_replay", options, function (result) {
				resolve(result);
			});
		});
	};
};

module.exports = osu;