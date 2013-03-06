'use strict';

(function() {

  describe('browser filter model', function() {
    var browser, Filter, models, Y;

    before(function(done) {
      Y = YUI(GlobalConfig).use([
        'juju-models', 'juju-browser-models'], function(Y) {
        models = Y.namespace('juju.models');
        browser = models.browser;
        Filter = browser.Filter;
        done();
      });
    });

    // Ensure the search results are rendered inside the container.
    it('defaults to an initial filter set', function() {
      var filter = new Filter();
      filter.get('category').should.eql([
        'databases', 'file_servers', 'app_servers', 'cache_proxy',
        'applications', 'miscellaneous']);
      filter.get('provider').should.eql(['aws', 'openstack']);
      filter.get('scope').should.eql(['public']);
      filter.get('series').should.eql(['precise']);
      filter.get('type').should.eql(['approved']);
    });

    it('constructs a valid query string based on settings.', function() {
      var filter = new Filter();
      filter.genQueryString().should.equal([
        'category=databases&category=file_servers&category=app_servers&',
        'category=cache_proxy&category=applications&category=miscellaneous',
        '&provider=aws&provider=openstack&scope=public&series=precise&',
        'type=approved'
      ].join(''));

      filter.set('category', []);
      filter.genQueryString().should.equal([
        'provider=aws&provider=openstack&scope=public&',
        'series=precise&type=approved'
      ].join(''));
    });
  });

})();
