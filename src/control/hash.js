/* global L */

'use strict';

var util = require('../util/util');

var HashControl = L.Class.extend({
  addTo: function(map) {
    if (this._supported) {
      this._map = map;
      this._onHashChange();
      this._startListening();
    } else {
      window.alert('Sorry, but the hash control does not work for maps that are loaded in an iframe hosted from another domain.');
    }
  },
  initialize: function() {
    this._iframe = false;
    this._supported = true;
    this._window = window;

    if ((window.self !== window.top) && document.referrer !== '') {
      if (util.parseDomainFromUrl(document.referrer) === util.parseDomainFromUrl(window.location.href)) {
        try {
          this._iframe = true;
          this._window = top;
        } catch (exception) {
          this._supported = false;
        }
      } else {
        this._supported = false;
      }
    }

    if (this._supported) {
      this._supportsHashChange = (function() {
        var docMode = window.documentMode;

        return ('onhashchange' in window) && (docMode === undefined || docMode > 7);
      })();
      this._supportsHistory = (function() {
        if (window.history && window.history.pushState) {
          return true;
        } else {
          return false;
        }
      })();
    }

    return this;
  },
  removeFrom: function() {
    if (this._changeTimeout) {
      clearTimeout(this._changeTimeout);
    }

    if (this.isListening) {
      this._stopListening();
    }

    delete this._map.hashControl;
    this._map = null;
  },
  _changeDefer: 100,
  _changeTimeout: null,
  _hashChangeInterval: null,
  _isListening: false,
  _lastHash: null,
  _movingMap: false,
  _formatHash: function(map) {
    var center = map.getCenter(),
      zoom = map.getZoom(),
      precision = Math.max(0, Math.ceil(Math.log(zoom) / Math.LN2));

    return '#' + [
      zoom,
      center.lat.toFixed(precision),
      center.lng.toFixed(precision)
    ].join('/');
  },
  _getParentDocumentWindow: function(el) {
    while (el.parentNode) {
      el = el.parentNode;

      if (el.tagName.toLowerCase() === 'window') {
        return el;
      }
    }

    return null;
  },
  _onHashChange: function() {
    if (!this._changeTimeout) {
      var me = this;

      this._changeTimeout = setTimeout(function() {
        me._update();
        me._changeTimeout = null;
      }, this._changeDefer);
    }
  },
  _onMapMove: function() {
    var hash;

    if (this._movingMap || !this._map._loaded) {
      return false;
    }

    hash = this._formatHash(this._map);

    if (this._lastHash !== hash) {
      if (this._supportsHistory) {
        var location = this._window.location;

        this._window.history.replaceState({}, '', location.origin + location.pathname + location.search + hash);
      } else {
        if (this._iframe) {
          // TODO: This preserves browser history, and is only partially working.
          this._window.location.hash = hash;
        } else {
          this._window.location.replace(hash);
        }
      }

      this._lastHash = hash;
    }
  },
  _parseHash: function(hash) {
    var args;

    if (hash.indexOf('#') === 0) {
      hash = hash.substr(1);
    }

    args = hash.split('/');

    if (args.length === 3) {
      var lat = parseFloat(args[1]),
        lng = parseFloat(args[2]),
        zoom = parseInt(args[0], 10);

      if (isNaN(zoom) || isNaN(lat) || isNaN(lng)) {
        return false;
      } else {
        return {
          center: new L.LatLng(lat, lng),
          zoom: zoom
        };
      }
    } else {
      return false;
    }
  },
  _startListening: function() {
    var me = this;

    this._map.on('moveend', this._onMapMove, this);

    if (this._supportsHashChange) {
      L.DomEvent.addListener(this._window, 'hashchange', function() {
        me._onHashChange(me);
      });
    } else {
      clearInterval(this._hashChangeInterval);
      this._hashChangeInterval = setInterval(function() {
        me._onHashChange(me);
      }, 50);
    }

    this._isListening = true;
  },
  _stopListening: function() {
    this._map.off('moveend', this._onMapMove, this);

    if (this._supportsHashChange) {
      L.DomEvent.removeListener(this._window, 'hashchange', this._onHashChange, this);
    } else {
      clearInterval(this._hashChangeInterval);
      this._hashChangeInterval = null;
    }

    this._isListening = false;
  },
  _update: function() {
    var hash = this._window.location.hash,
      parsed;

    if (hash === this._lastHash) {
      return;
    }

    parsed = this._parseHash(hash);

    if (parsed) {
      this._movingMap = true;
      this._map.setView(parsed.center, parsed.zoom);
      this._movingMap = false;
    } else {
      this._onMapMove(this._map);
    }
  }
});

L.Map.addInitHook(function() {
  if (this.options.hashControl) {
    this.hashControl = L.npmap.control.hash(this.options.hashControl).addTo(this);
  }
});

module.exports = function(options) {
  return new HashControl(options);
};
