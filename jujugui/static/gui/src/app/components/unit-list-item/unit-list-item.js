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

YUI.add('unit-list-item', function() {

  juju.components.UnitListItem = React.createClass({

    /**
      Get the current state of the inspector.

      @method getInitialState
      @returns {String} The current state.
    */
    getInitialState: function() {
      // Setting a default state object.
      return {
        checked: this.props.checked
      };
    },

    /**
      Handles the checkbox change action by either calling the parent supplied
      whenChanged method and by setting the local checked state.

      @method _handleChange
      @param {Object} The change event from the checkbox.
    */
    _handleChange: function(e) {
      var whenChanged = this.props.whenChanged;
      var checked = e.currentTarget.checked;
      // When whenChanged is set by the list parent and is used
      // to (de)select all checkboxes.
      if (whenChanged) {
        whenChanged(checked);
      }
      this.setState({checked: checked});
    },

    componentWillReceiveProps: function(nextProps) {
      this.setState({checked: nextProps.checked});
    },

    render: function() {
      var id = this.props.label + '-unit';
      return (
        <li className="unit-list-item">
          <input
            type="checkbox"
            id={id}
            onChange={this._handleChange}
            checked={this.state.checked} />
          <label htmlFor={id}>{this.props.label}</label>
        </li>
      );
    }

  });

}, '0.1.0', { requires: []});