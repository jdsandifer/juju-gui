/*
This file is part of the Juju GUI, which lets users view and manage Juju
environments within a graphical interface (https://launchpad.net/juju-gui).
Copyright (C) 2012-2015 Canonical Ltd.

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU Affero General Public License version 3, as published by
the Free Software Foundation.

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranties of MERCHANTABILITY,
SATISFACTORY QUALITY, or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero
General Public License for more details.

You should have received a copy of the GNU Affero General Public License along
with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

'use strict';

/**
 * Bakery holds the context for making HTTP requests
 * that automatically acquire and discharge macaroons.
 *
 * @module env
 * @submodule env.bakery
 */

YUI.add('juju-env-bakery', function(Y) {

  var module = Y.namespace('juju.environments.web');
  var macaroon = Y.namespace('macaroon');

  // Define the bakery protocol version used by the GUI.
  const PROTOCOL_VERSION = 1;
  // Define the HTTP content type for JSON requests.
  const JSON_CONTENT_TYPE = 'application/json';

  /**
   * Bakery client inspired by the equivalent GO code.
   *
   * This object exposes the ability to perform requests
   * that automatically acquire and discharge macaroons.
   *
   * @class Bakery
   */

  var Bakery = Y.Base.create('Bakery',
    Y.Base, [], {

      /**
        Create and return the bakery.

        @param {Object} cfg Parameters for the bakery, including:
          - serviceName: the name of the service for which this bakery is used;
          - visitMethod: the action used to visit the URL for logging into the
            identity provider. The callable is provided the idm response
            including the visit URL as "response.Info.VisitURL". If not
            specified, a default visit method is used, opening a pop up;
          - interactive: whether to use interactive mode (the default) or
            non-interactive mode, in which case the visitMethod is never used,
            as the bakery is assumed to already have the required tokens;
          - onSuccess: an optional function to be called once the macaraq has
            been successfully completed;
          - setCookie: An optional boolean indicating whether to add a macaroon
            to the document cookies;
          - setCookiePath: optional string representing the endpoint register a
            macaroon as a cookie;
          - dischargeStore: an optional customized discharge storage;
          - macaroon: an initial macaroon to be included in the storage;
          - dischargeToken: optional token to be used when discharging.
       */
      initializer: function (cfg) {
        this.webhandler = cfg.webhandler;
        if (cfg.visitMethod) {
          this.visitMethod = cfg.visitMethod;
        } else if (cfg.interactive !== undefined && !cfg.interactive) {
          this.visitMethod = this._nonInteractiveVisitMethod;
        } else {
          this.visitMethod = this._defaultVisitMethod;
        }
        this._onSuccess = cfg.onSuccess || (() => {});
        this.macaroonName = 'Macaroons-' + cfg.serviceName;
        this.staticMacaroonPath = cfg.staticMacaroonPath;
        this.setCookiePath = cfg.setCookiePath;
        this.setCookie = cfg.setCookie;
        this.nonceLen = 24;
        this.user = cfg.user;
        if (!this.user) {
          console.error('bakery instantiated without user authentication');
          return;
        }
        if (cfg.macaroon) {
          this.user.setMacaroon(
            this.macaroonName, cfg.macaroon, this.setCookie);
        }
        if (cfg.dischargeToken) {
          this.user.identity = cfg.dischargeToken;
        }
      },


      /**
        Returns a macaroon for this bakery instance. If a macaroon has already
        been stored it will return that. If not, it makes a request to the
        staticMacaroonPath to fetch and discharge and store a new macaroon for
        later use.

        @method fetchMacaroonFromStaticPath
        @param {Function} callback The callback that gets called for success
          or failure at any point in the macaroon chain.
        @return {undefined}
      */
      fetchMacaroonFromStaticPath: function(callback) {
        var savedMacaroon = this.getMacaroon();
        if (savedMacaroon !== null) {
          callback(null, savedMacaroon);
          return;
        }
        if (!this.staticMacaroonPath) {
          callback('Static macaroon path was not defined.');
          return;
        }
        return this.webhandler.sendGetRequest(
          this.staticMacaroonPath, null, null, null, false, null,
          this._interactivePrefetch.bind(this, callback));
      },

      /**
        Handler for the interactive macaroon prefetch.

        @method _interactivePrefetch
        @param {Function} callback The callback to be called after success
          or failure.
        @param {Object} The response object from the staticMacaroonPath fetch.
        @return {undefined}
      */
      _interactivePrefetch: function(callback, res) {
        var macaroon = {};
        try {
          macaroon = JSON.parse(res.target.responseText);
        } catch(e) {
          callback(e);
          return;
        }
        this._authenticate(macaroon, function() {
          callback(null, this.getMacaroon());
        }.bind(this), callback);
      },

      /**
       Prepare and return HTTP request headers for macaraq requests.

       @param {Object} overrides Any additional headers.
       @return {Object} The resulting request headers.
      */
      _prepareHeaders: function(overrides) {
        const headers = {'Bakery-Protocol-Version': PROTOCOL_VERSION};
        Object.keys(overrides || {}).forEach(key => {
          headers[key] = overrides[key];
        });
        const macaroons = this.getMacaroon();
        if (macaroons !== null) {
          headers['Macaroons'] = macaroons;
        }
        return headers;
      },

      /**
       Takes the path supplied by the caller and makes a get request to the
       requestHandlerWithInteraction instance. If setCookiePath is set then
       it is used to set a cookie back to the ui after authentication.

       @param {String} The path to make the api request to.
       @param {Function} successCallback Called when the api request completes
              successfully.
       @param {Function} failureCallback Called when the api request fails
              with a response of >= 400 except 401 and a WWW-Authenticate
              header will trigger authentication.
       @param {Boolean} redirect Whether the handler should redirect if there
              is a 401 on the request.
       @return {Object} The asynchronous request instance.
      */
      sendGetRequest: function(
        path, successCallback, failureCallback, redirect) {
        const onAuthDone = this._requestHandler.bind(
          this, successCallback, failureCallback);
        const onAuthRequired = function() {
          return this.webhandler.sendGetRequest(
            path, this._prepareHeaders(null), null, null, false, null,
            onAuthDone);
        }.bind(this);
        return this.webhandler.sendGetRequest(
          path, this._prepareHeaders(null), null, null, false, null,
          this._requestHandlerWithInteraction.bind(
            this, onAuthRequired, onAuthDone, failureCallback, redirect)
        );
      },

      /**
       Takes the path supplied by the caller and makes a delete request to the
       requestHandlerWithInteraction instance. If setCookiePath is set then
       it is used to set a cookie back to the ui after authentication.

       @param {String} The path to make the api request to.
       @param {Function} successCallback Called when the api request completes
              successfully.
       @param {Function} failureCallback Called when the api request fails
              with a response of >= 400 except 401 and a WWW-Authenticate
              header will trigger authentication.
       @param {Boolean} redirect Whether the handler should redirect if there
              is a 401 on the request.
       @return {Object} The asynchronous request instance.
      */
      sendDeleteRequest: function(
        path, successCallback, failureCallback, redirect) {
        const onAuthDone = this._requestHandler.bind(
          this, successCallback, failureCallback);
        const onAuthRequired = function() {
          return this.webhandler.sendDeleteRequest(
            path, this._prepareHeaders(null), null, null, false, null,
            onAuthDone);
        }.bind(this);
        return this.webhandler.sendDeleteRequest(
          path, this._prepareHeaders(null), null, null, false, null,
          this._requestHandlerWithInteraction.bind(
            this, onAuthRequired, onAuthDone, failureCallback, redirect)
        );
      },

      /**
       Takes the path supplied by the caller and makes a post request to the
       requestHandlerWithInteraction instance. If setCookiePath is set then
       it is used to set a cookie back to the ui after authentication.

       @param path {String} The path to make the api request to.
       @param data {String} Stringified JSON of parameters to send to the POST
              endpoint.
       @param successCallback {Function} Called when the api request completes
              successfully.
       @param failureCallback {Function} Called when the api request fails
              with a response of >= 400 except 401/407 where it does
              authentication.
       @param {Boolean} redirect Whether the handler should redirect if there
              is a 401 on the request.
       @param {Object} response The XHR response object from initial request.
      */
      sendPostRequest: function(
        path, data, successCallback, failureCallback, redirect) {
        const onAuthDone = this._requestHandler.bind(
          this, successCallback, failureCallback);
        const onAuthRequired = function() {
          return this.webhandler.sendPostRequest(
            path, this._prepareHeaders({'Content-type': JSON_CONTENT_TYPE}),
            data, null, null, false, null, onAuthDone);
        }.bind(this);
        return this.webhandler.sendPostRequest(
          path, this._prepareHeaders({'Content-type': JSON_CONTENT_TYPE}),
          data, null, null, false, null,
          this._requestHandlerWithInteraction.bind(
            this, onAuthRequired, onAuthDone, failureCallback, redirect)
        );
      },

      /**
       Takes the path supplied by the caller and makes a put request to the
       requestHandlerWithInteraction instance. If setCookiePath is set then
       it is used to set a cookie back to the ui after authentication.

       @param path {String} The path to make the api request to.
       @param data {String} Stringified JSON of parameters to send to the POST
              endpoint.
       @param successCallback {Function} Called when the api request completes
              successfully.
       @param failureCallback {Function} Called when the api request fails
              with a response of >= 400 except 401/407 where it does
              authentication.
       @param {Boolean} redirect Whether the handler should redirect if there
              is a 401 on the request.
       @param {Object} response The XHR response object from initial request.
      */
      sendPutRequest: function(
        path, data, successCallback, failureCallback, redirect) {
        const onAuthDone = this._requestHandler.bind(
          this, successCallback, failureCallback);
        const onAuthRequired = function() {
          return this.webhandler.sendPutRequest(
            path, this._prepareHeaders({'Content-type': JSON_CONTENT_TYPE}),
            data, null, null, false, null, onAuthDone);
        }.bind(this);
        return this.webhandler.sendPutRequest(
          path, this._prepareHeaders({'Content-type': JSON_CONTENT_TYPE}),
          data, null, null, false, null,
          this._requestHandlerWithInteraction.bind(
            this, onAuthRequired, onAuthDone, failureCallback, redirect)
        );
      },

      /**
       Takes the path supplied by the caller and makes a patch request to the
       requestHandlerWithInteraction instance. If setCookiePath is set then
       it is used to set a cookie back to the ui after authentication.

       @param path {String} The path to make the api request to.
       @param data {String} Stringified JSON of parameters to send to the PATCH
              endpoint.
       @param successCallback {Function} Called when the api request completes
              successfully.
       @param failureCallback {Function} Called when the api request fails
              with a response of >= 400 except 401/407 where it does
              authentication.
       @param {Boolean} redirect Whether the handler should redirect if there
              is a 401 on the request.
       @param {Object} response The XHR response object from initial request.
      */
      sendPatchRequest: function(
        path, data, successCallback, failureCallback, redirect) {
        const onAuthDone = this._requestHandler.bind(
          this, successCallback, failureCallback);
        const onAuthRequired = function() {
          return this.webhandler.sendPatchRequest(
            path, this._prepareHeaders({'Content-type': JSON_CONTENT_TYPE}),
            data, null, null, false, null, onAuthDone);
        }.bind(this);
        return this.webhandler.sendPatchRequest(
          path, this._prepareHeaders({'Content-type': JSON_CONTENT_TYPE}),
          data, null, null, false, null,
          this._requestHandlerWithInteraction.bind(
            this, onAuthRequired, onAuthDone, failureCallback, redirect)
        );
      },

      /**
        Handle sending requests after authenticating using macaroons.

        @method _requestHandlerWithInteraction
        @param {Function} onAuthRequired The original request to be performed
          after authenticating.
        @param {Function} onAuthDone Called when the response is finally
          available.
        @param {Function} onFailure Called when there are errors in the
          authentication process.
        @param {Boolean} redirect Whether the handler should redirect if there
          is a 401 on the request.
        @param {Object} response The XHR response object.
      */
      _requestHandlerWithInteraction: function (
        onAuthRequired, onAuthDone, onFailure, redirect=true, response) {
        const target = response.target;
        // XXX I reliably recieve a 401 when signing in for the first time.
        // This may not be the best path forward. Makyo 2016-04-25
        if (
          target.status === 401 &&
          target.getResponseHeader('Www-Authenticate') === 'Macaroon' &&
          redirect === true
        ) {
          const jsonResponse = JSON.parse(target.responseText);
          this._authenticate(
            jsonResponse.Info.Macaroon, onAuthRequired, onFailure);
          return;
        }
        onAuthDone(response);
      },

      /**
       Handles the request response from the _makeRequest method, calling the
       supplied failure callback if the response status was >= 400 or passing
       the response object to the supplied success callback.

       @method _requestHandler
       @param {Function} successCallback Called when the api request completes
              successfully.
       @param {Function} failureCallback Called when the api request fails
              with a response of >= 400.
       @param {Object} response The XHR response object.
       @return {undefined} Nothing.
       */
      _requestHandler: function (successCallback, failureCallback, response) {
        if (response.target.status >= 400) {
          failureCallback(response);
          return;
        }
        successCallback(response);
      },

      /**
       Authenticate by discharging the macaroon and
       then set the cookie by calling the authCookiePath provided.

       @method authenticate
       @param {Macaroon} The macaroon to be discharged.
       @param {Function} The request to be sent again in case of
              successful authentication.
       @param {Function} The callback failure in case of wrong authentication.
       @return {undefined} Nothing.
       */
      _authenticate: function (m, requestFunc, failureCallback) {
        var successCallback = this._processDischarges.bind(
          this, requestFunc, failureCallback);
        this.discharge(m, successCallback, failureCallback);
      },

      /**
        Discharge the macaroon.

        @method discharge
        @param {Macaroon} m The macaroon to be discharged.
        @param {Function} successCallback The callable to be called if the
          discharge succeeds. It receives the resulting macaroons array.
        @param {Function} failureCallback The callable to be called if the
          discharge fails. It receives an error message.
      */
      discharge: function(m, successCallback, failureCallback) {
        const successCB = macaroons => {
          successCallback(macaroons);
          this._onSuccess();
        };
        try {
          macaroon.discharge(
            macaroon.import(m),
            this._obtainThirdPartyDischarge.bind(this),
            function(discharges) {
              successCB(macaroon.export(discharges));
            },
            failureCallback
          );
        } catch (exc) {
          failureCallback('discharge failed: ' + exc.message);
        }
      },

      /**
       Process the discharged macaroon and call the end point to be able to set
       a cookie for the origin domain only when an auth cookie path is
       provided, then call the original function.

       @method _processDischarges
       @param {Function} The request to be sent again in case of
              successful authentication.
       @param {Function} The callback failure in case of wrong authentication.
       @param {[Macaroon]} The macaroons being discharged.
       @return {Object} The asynchronous request instance.
       */
      _processDischarges: function (requestFunc, failureCallback, macaroons) {
        var content = JSON.stringify({'Macaroons': macaroons});
        if (this.setCookiePath === undefined) {
          this._successfulDischarges(requestFunc, macaroons);
          return;
        }
        const btoaMacaroon = btoa(JSON.stringify(macaroons));
        this.user.setMacaroon(this.macaroonName, btoaMacaroon, this.setCookie);
        return this.webhandler.sendPutRequest(
          this.setCookiePath,
          null, content, null, null, true, null,
          this._requestHandler.bind(
            this,
            this._successfulDischarges.bind(this, requestFunc, macaroons),
            failureCallback
          )
        );
      },

      /**
       Process successful discharge by setting Macaroons Cookie
       and invoke the original request.

       @method _successfulDischarges
       @param {Function} The path where to send put request
              to set the cookie back.
       @param {Object} an exported Macaroon.
       @return {undefined} Nothing.
       */
      _successfulDischarges: function (originalRequest, jsonMacaroon) {
        const btoaMacaroon = btoa(JSON.stringify(jsonMacaroon));
        this.user.setMacaroon(this.macaroonName, btoaMacaroon, this.setCookie);
        originalRequest();
      },

      /**
       Go to the discharge endpoint to obtain the third party discharge.

       @method obtainThirdPartyDischarge
       @param {String} The origin location.
       @param {String} The third party location where to discharge.
       @param {Function} The macaroon to be discharge.
       @param {Function} The request to be sent again in case of
              successful authentication.
       @param {Function} The callback failure in case of wrong authentication.
       @return {Object} The asynchronous request instance.
       */
      _obtainThirdPartyDischarge: function (location,
                                            thirdPartyLocation, condition,
                                            successCallback, failureCallback) {
        thirdPartyLocation += '/discharge';

        const dischargeToken = this.user.identity;
        var headers = {
          'Bakery-Protocol-Version': 1,
          'Content-Type': 'application/x-www-form-urlencoded'
        };
        if (dischargeToken) {
          headers['Macaroons'] = dischargeToken;
        }
        var content = 'id=' + encodeURIComponent(condition) +
          '&location=' + encodeURIComponent(location);
        return this.webhandler.sendPostRequest(
          thirdPartyLocation,
          headers, content, null, null, false, null,
          this._requestHandler.bind(
            this,
            this._exportMacaroon.bind(this, successCallback, failureCallback),
            this._interact.bind(this, successCallback, failureCallback)
          )
        );
      },

      /**
       Get a JSON response from authentication either trusted or with
       interaction that contains a macaroon.

       @method _exportMacaroon
       @param {Function} The callback function to be sent in case of
              successful authentication
       @param {Function} The callback function failure in case of
              wrong authentication
       @param {Object} response The XHR response object from initial request.
      */
      _exportMacaroon: function (successCallback, failureCallback, response) {
        try {
          var json = JSON.parse(response.target.responseText);
          if (json.DischargeToken !== undefined &&
              json.DischargeToken !== '') {
            this.user.identity = btoa(JSON.stringify(json.DischargeToken));
          }
          successCallback(macaroon.import(json.Macaroon));
        } catch (ex) {
          failureCallback(ex.message);
        }
      },

      /**
       Interact to be able to sign-in to get authenticated.

       @method _interact
       @param {Function} The callback function to be sent in case of
              successful authentication.
       @param {Function} The callback function failure in case of
              wrong authentication.
       @param {Function} The callback function failure in case of
              wrong authentication.
       @param {Object} response The XHR response object from initial request.
       @return {Object} The asynchronous request instance.
       */
      _interact: function(successCallback, failureCallback, e) {
        const response = JSON.parse(e.target.responseText);
        if (response.Code !== 'interaction required') {
          failureCallback(response.Code);
          return;
        }
        this.visitMethod(response);
        const generateRequest = callback => {
          return this.webhandler.sendGetRequest(
              response.Info.WaitURL,
              {'Content-Type': JSON_CONTENT_TYPE},
              null, null, false, null, callback);
        };
        // When performing a "wait" request for the user logging into identity
        // it is possible that they take longer than the server timeout of
        // 1 minute: when this happens the server just closes the connection.
        let retryCounter = 0;
        const retryCallback = reqResponse => {
          const target = reqResponse.target;
          if (target.status === 0 &&
              target.response === '' &&
              target.responseText === '') {
            // Server closed the connection, retry and increment the counter.
            if (retryCounter < 5) {
              retryCounter += 1;
              generateRequest(retryCallback);
              return;
            }
            // We have retried 5 times so fall through to call handler.
          }
          // Call the usual request handler if no retry is necessary.
          this._requestHandler(
            this._exportMacaroon.bind(this, successCallback, failureCallback),
            failureCallback,
            reqResponse);
        };
        generateRequest(retryCallback);
      },

      /**
       Non interactive visit method which sends the jujugui "auth" blob
       to the IdM to login.

       @method _nonInteractiveVisitMethod
       @param {Object} response The XHR response object from initial request.
       @return {Object} The asynchronous request instance.
      */
      _nonInteractiveVisitMethod: function(response) {
        var acceptHeaders = {'Accept': JSON_CONTENT_TYPE};
        var contentHeaders = {'Content-Type': JSON_CONTENT_TYPE};
        var login = function(response) {
          var method = JSON.parse(response.target.responseText).jujugui;
          var data = JSON.stringify({login: window.juju_config.auth});
          return this.webhandler.sendPostRequest(
              method, contentHeaders, data,
              null, null, false, null, null);
        };

        return this.webhandler.sendGetRequest(
            response.Info.VisitURL,
            acceptHeaders, null, null, false, null, login.bind(this));
      },

      /**
       Adds a public-key encrypted third party caveat.

       @method addThirdPartyCaveat
       @param {macaroon object} The macaroon to add the caveat to.
       @param {String} The condition for the third party to verify.
       @param {String} The URL of the third party.
       @param {Uint8Array} The third party public key to use (as returned
              by nacl.box.keyPair().publicKey.
       @param {Object} The encoding party's key pair (as returned
              by nacl.box.keyPair()).
       @return {undefined} Nothing.
       */
      addThirdPartyCaveat: function(m, condition, location,
                                    thirdPartyPublicKey, myKeyPair) {
        var nonce = nacl.randomBytes(this.nonceLen);
        var rootKey = nacl.randomBytes(this.nonceLen);
        var plain = JSON.stringify({
          RootKey: nacl.util.encodeBase64(rootKey), Condition: condition
        });
        var sealed = nacl.box(nacl.util.decodeUTF8(plain), nonce,
                              thirdPartyPublicKey, myKeyPair.secretKey);
        var caveatIdObj = {
          ThirdPartyPublicKey: nacl.util.encodeBase64(thirdPartyPublicKey),
          FirstPartyPublicKey: nacl.util.encodeBase64(myKeyPair.publicKey),
          Nonce:               nacl.util.encodeBase64(nonce),
          Id:                  nacl.util.encodeBase64(sealed),
        };
        var caveatId = JSON.stringify(caveatIdObj);

        m.addThirdPartyCaveat(rootKey, caveatId, location);
      },

      /**
       Discharges a public-key encrypted third party caveat.

       @param {String} The third party caveat id to check.
       @param {Object} The third party's key pair (as returned
              by nacl.box.keyPair()).
       @param {function} A function that is called to check the condition.
              It should throw an exception if the condition is not met.
       @return {macaroon} The macaroon that discharges the caveat.
       */
      dischargeThirdPartyCaveat: function(caveatId, myKeyPair, check) {
        var caveatIdObj = {};
        try {
          caveatIdObj = JSON.parse(caveatId);
        } catch(ex) {
          throw new Exception('Unable to parse caveatId');
        }
        if(nacl.util.encodeBase64(myKeyPair.publicKey) !==
           caveatIdObj.ThirdPartyPublicKey) {
          throw new Exception('public key mismatch');
        }
        var nonce = nacl.util.decodeBase64(caveatIdObj.Nonce);
        var firstPartyPub = nacl.util.decodeBase64(
          caveatIdObj.FirstPartyPublicKey
        );
        if(nonce.length !== this.nonceLen) {
          throw new Exception('bad nonce length');
        }
        var sealed = nacl.util.decodeBase64(caveatIdObj.Id);
        var unsealed = nacl.box.open(sealed, nonce, firstPartyPub,
                                     myKeyPair.secretKey);

        var unsealedStr = nacl.util.encodeUTF8(unsealed);
        var plain = JSON.parse(unsealedStr);
        if(plain.Condition === undefined) {
          throw new Exception('empty condition in third party caveat');
        }
        // Check that the condition actually holds.
        check(plain.Condition);
        return macaroon.newMacaroon(
            nacl.util.decodeBase64(plain.RootKey), caveatId, '');
      },

      /**
       Non interactive visit method which sends the jujugui "auth" blob
       to the IdM to login.

       @method _nonInteractiveVisitMethod
       @param {Object} response The XHR response object from initial request.
       @return {undefined} Nothing.
      */
      _defaultVisitMethod: function(response) {
        window.open(response.Info.VisitURL, 'Login');
      },

      /**
       Get macaroon from local cookie.

       @method getMacaroon
       @return {String} Macaroon that was set in local cookie.
       */
      getMacaroon: function() {
        return this.user.getMacaroon(this.macaroonName);
      },

      /**
        Clears the cookies saved for macaroons.

        @method clearCookie
      */
      clearCookie: function() {
        this.user.clearMacaroon(this.macaroonName, this.setCookie);
        this.user.identity = null;
      }
    }
  );

  module.Bakery = Bakery;

}, '0.1.0', {
  requires: [
    'base',
    'cookie',
    'node',
    'juju-env-base',
    'juju-env-web-handler',
    'macaroon'
  ]
});
