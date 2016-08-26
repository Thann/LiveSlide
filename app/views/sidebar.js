require('styles/sidebar.css');
require('utils/context_menu.js');

var AppConfig = require('app/config');
var UploadModal = require('views/upload_modal');
var ImgurLoader = require('utils/imgur_loader.js');

console.log("upload_modal", UploadModal)

module.exports = RTChat.Views.Sidebar.extend({
	template: `
		<a rv-unless="scope.imgur_account_name"
			rv-href="'https://api.imgur.com/oauth2/authorize?client_id=' |+ scope.clientId |+ '&response_type=token&state=' |+ scope.hash">
			Sign-in with Imgur to upload
		</a>
		<div rv-if="scope.imgur_account_name" class="dropdown" >
			<div rv-data-acct-name="scope.imgur_account_name">
					{ scope.imgur_account_name }
					<span class="pull-right fa fa-ellipsis-v"></span>
					<span class="pull-right fa fa-upload"></span>
			</div>
			<ul class="album">
				<li rv-each-album="scope.user_albums" rv-data-id="album.id">
					{ album.title }
				</li>
			</ul>
		</div>
		<div class="add-acct">
			<span rv-hide="scope.editing">Add  Imgur Account </span>
			<input rv-show="scope.editing" placeholder="Imgur Account Name">
		</div>
		<div rv-each-user="scope.iaccts" class="dropdown" >
			<div rv-data-acct-name="user.name">
				{ user.name  }
				<span class="pull-right fa fa-ellipsis-v"></span>
			</div>
			<ul class="album">
				<li rv-each-album="user.albums" rv-data-id="album.id">
					{ album.title }
				</li>
			</ul>
		</div>
		<div data-subview="context_menu"></div>
		<div data-subview="upload_modal"></div>
	`,
	contextMenuTemplate: `
			<li class="delete"><a> Remove </a></li>
	`,
	events: {
		'click .album > li': function(e) {
			// Load Presentation
			var target = this.$(e.currentTarget)
			ImgurLoader.getAlbum(target.data('id'), function(album) {
				RTChat.RTCWrapper.updateState({
					albumId: album.id,
					title: album.title,
					slides: _.map(album.images, function(i) {return i.link.replace(/^http:/,'https:')}),
					currentSlide: 0,
				});
			});
			// target.addClass("selected"); //TODO: loading?
			this.toggle(); // close //TODO: UX: do we want this?
		},
		'click .fa-upload': function() {
			// UploadModal.render();
			this.subviews.upload_modal.show();
		},
		// 'click .fa-refresh': function() {
		// 	this.getAlbums();
		// },
		'click .add-acct': function(ev) {
			this.scope.editing = true;
			this.$(ev.currentTarget).find('input').val("").focus();
		},
		'keyup .add-acct input': function(ev) {
			if (ev.keyCode != 13) return true;
			this.scope.editing = false;
			if (!this.scope.other_imgur_accounts) this.scope.other_imgur_accounts = [];
			var name = this.$(ev.currentTarget).val();

			var self = this;
			// Add the acct to iaccts instantly because it will be populated asynchronously.
			this.scope.iaccts.push(this.getAlbums([name], function(acct) {
				// Now that we have the exact acct name, add it to the list.
				self.scope.other_imgur_accounts.push(acct.name);
				RTChat.UserService.setAppConf({
					other_imgur_accounts: self.scope.other_imgur_accounts
				});
			})[0]);
		},
		'blur .add-acct input': function(ev) {
			this.scope.editing = false;
		},
		// == ContextMenu == //
		'click #ContextMenu li.delete': function() {
			if (this.menu_target == this.scope.imgur_account_name) {
				// Remove user account info. this.scope.
				RTChat.UserService.setAppConf({
					imgur_account_name: undefined,
					imgur_refresh_token: undefined
				});
			} else {
				// Remove from other_imgur_accounts
				var ii = this.scope.other_imgur_accounts.indexOf(this.menu_target)
				if (ii >= 0) {
					//TODO: only calling setAppConf is needed.
					this.scope.other_imgur_accounts.splice(ii, 1);
					RTChat.UserService.setAppConf({
						other_imgur_accounts: this.scope.other_imgur_accounts
						// other_imgur_accounts: []
					});
				}

				// Remove from iaccts
				ii = _.findIndex(this.scope.iaccts, {name: this.menu_target});
				if (ii >= 0) this.scope.iaccts.splice(ii, 1);
			}
		},
		'click .fa-ellipsis-v': function(ev) {
			this.subviews.context_menu.toggle(ev.currentTarget);
			this.menu_target = $(ev.currentTarget).parent('[data-acct-name]').data("acct-name");
			ev.stopPropagation(); // Needed or else the body listener hack will close it immediately.
		},
		'scroll': function() {
			this.subviews.context_menu.hide();
		},
	},
	initialize: function() {
		var self = this;
		Backbone.Subviews.add( this );
		//HACK: close context_menu on click anywhere.
		$('body').on('click', function() { self.subviews.context_menu.hide(); });
	},
	subviewCreators: {
		// Extend ContextMenu
		context_menu: function() { return new (RTChat.Views.ContextMenu.extend({
			className: 'dropdown-menu', // Use Bootstrap styling
			template: this.contextMenuTemplate,
		}))() },
		upload_modal: function() { return new UploadModal(); }
	},
	// Returns an array of accounts with albums populated asynchronously.
	// Callback gets called once for every acct when populated.
	getAlbums: function(list_of_account_names, callback) {
		if (!list_of_account_names) return []; // Don't fail when passed undefined.
		var accounts = [];

		var self = this;
		_.forEach(list_of_account_names, function(a) {
			var acct = { name: a };

			// Add it now so it shows up in the GUI, then add the albums asynchronously.
			accounts.push(acct);

			ImgurLoader.listAlbums(a, function(list) {
				console.log("got list", acct.name, list)

				if (list.length)
				_.extend(acct, {
					name: list[0].account_url,
					// Remove empty albums
					albums: _.reject(list, function(o) { return o.images_count == 0 })
				});

				if (callback) callback.call(this, acct);
			});
		});

		return accounts;
	},
	getAllAlbums: function() {

	},
	render: function() {
		this.scope = RTChat.UserService.getAppConf()
		this.scope.hash = window.location.hash.substring(1);
		this.scope.clientId = AppConfig['imgur_client_id'];
		this.scope.user_albums = this.getAlbums([this.scope.imgur_account_name])[0]
		this.scope.iaccts = this.getAlbums(this.scope.other_imgur_accounts);

		this.$el.html(this.template);
		Rivets.bind(this.$el, {scope: this.scope});

		// start closed.
		this.$el.removeClass('open');

		var self = this;
		RTChat.RTCWrapper.onStateChange(function(old, newState) {
			// Open or close if starts or ends
			setTimeout(function() { //HACK: "extra" gets set by an onStateChange handler
				if (RTChat.RTCWrapper.connection.extra.isAdmin) {
					if (!newState.albumId && newState.admins) { //HACK: check admins to ensure we are still in a room
						self.$el.addClass('open');
					}
				}
			});

			// self.extra = RTChat.RTCWrapper.connection.extra;

			//TODO: update "selected"
			// if (old.presentation !== newState.presentation) {
			// 	self.scope.presentation = newState.presentation;
			// 	// Keep selection in sync.
			// 	self.$('.selected').removeClass('selected');
			// 	if (newState.presentation)
			// 		self.$('li[data-path="'+newState.presentation+'"]').addClass('selected');
			// }
			// if (old.albumId !== newState.albumId) {

			// if (!newState.albumId && RTChat.RTCWrapper.connection.extra.isAdmin) {
			// 	self.$el.toggleClass('open', !newState.albumId)
			// }

		});

		// this.$('li[data-path="'+this.scope.presentation+'"]').addClass('selected');
		return this;
	},
	scope: {}
});
