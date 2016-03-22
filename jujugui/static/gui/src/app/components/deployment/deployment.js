/*
This file is part of the Juju GUI, which lets users view and manage Juju
environments within a graphical interface (https://launchpad.net/juju-gui).
Copyright (C) 2015 Canonical Ltd.

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

YUI.add('deployment-component', function() {

  juju.components.Deployment = React.createClass({
    propTypes: {
      activeComponent: React.PropTypes.string,
      autoPlaceUnits: React.PropTypes.func.isRequired,
      changeDescriptions: React.PropTypes.array.isRequired,
      changeState: React.PropTypes.func.isRequired,
      ecsClear: React.PropTypes.func.isRequired,
      ecsCommit: React.PropTypes.func.isRequired,
      getUnplacedUnitCount: React.PropTypes.func.isRequired,
    },

    componentDidMount: function() {
      this._navigateToStart(this.props.activeComponent);
    },

    componentWillReceiveProps: function(nextProps) {
      this._navigateToStart(this.props.activeComponent);
    },

    /**
      Figure out what the first step in the deployment flow should be for the
      current user. e.g. if this user has signed up the skip to choosing
      credentials.

      @method _navigateToStart
      @param {String} activeComponent The current active component to display.
    */
    _navigateToStart: function(activeComponent) {
      // If an active component has been provided then that screen will be
      // displayed.
      if (!activeComponent) {
        // For now the first step will be choosing a cloud.
        var activeComponent = 'choose-cloud';
        this.props.changeState({
          sectionC: {
            component: 'deploy',
            metadata: {
              activeComponent: activeComponent
            }
          }
        });
      }
    },

    /**
      Generate the content for the active panel.

      @method _generateActivePanel
      @return {Object} The markup for the panel content.
    */
    _generateActivePanel: function() {
      switch (this.props.activeComponent) {
        case 'summary':
          return (
            <juju.components.DeploymentSummary
              autoPlaceUnits={this.props.autoPlaceUnits}
              changeDescriptions={this.props.changeDescriptions}
              changeState={this.props.changeState}
              ecsClear={this.props.ecsClear}
              ecsCommit={this.props.ecsCommit}
              getUnplacedUnitCount={this.props.getUnplacedUnitCount} />);
        case 'choose-cloud':
          return (
            <juju.components.DeploymentChooseCloud
              changeState={this.props.changeState} />);
      }
    },

    render: function() {
      var activeComponent = this.props.activeComponent;
      var activeChild = this._generateActivePanel();
      var steps = [{
        title: 'Choose cloud',
        component: 'choose-cloud'
      }, {
        title: 'Deploy',
        component: 'summary'
      }];
      return (
        <juju.components.DeploymentPanel
          activeComponent={activeComponent}
          changeState={this.props.changeState}
          steps={steps}>
          {activeChild}
        </juju.components.DeploymentPanel>
      );
    }

  });

}, '0.1.0', {
  requires: [
    'deployment-choose-cloud',
    'deployment-panel',
    'deployment-summary'
  ]
});
