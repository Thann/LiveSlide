// Wraps Imgur.com API for our use.

var AppConfig = require('app/config');

module.exports = {
	// Lists all albums in an imgur account (excludes empty ones)
	listAlbums: function(account, callback) {
		$.ajax({
			url: "https://api.imgur.com/3/account/"+account+"/albums",
			headers: {
				"Authorization": "Client-ID "+AppConfig['imgur_client_id']
			}
		}).success(function(data) {
			callback(data.data);
		});
	},
	// Gets a single album by ID
	getAlbum: function(id, callback) {
		$.ajax({
			url: "https://api.imgur.com/3/album/"+id,
			headers: {
				"Authorization": "Client-ID "+AppConfig['imgur_client_id']
			}
		}).success(function(data) {
			callback(data.data);
		});
	}
}