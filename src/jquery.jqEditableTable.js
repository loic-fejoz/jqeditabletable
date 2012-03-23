/**
 * A simple table editor. It shall convert a cell into an input on click, touch
 * or focus. It shall convert back the input into cell on focus lost or key
 * navigation. Input type can be set on column.
 */
(function($) {
	"use strict";
	function getChildrenIndex(child) {
		var i = 0;
		var current = child;
		while(current.previousSibling) {
			i++;
			current = current.previousSibling;
		}
		return i;
	}
	function makeNewEditableCell(theTable, tableEditableOptions, theColModel) {
		var colEditableOptions = theColModel['editableOptions'] ? theColModel['editableOptions']
				: {};
		var options = $.extend({}, tableEditableOptions, colEditableOptions)
		var userCallback = options['callback'];
		options['callback'] = function(value, settings) {
			if (userCallback) {
				userCallback.apply(value, settings);
			}
			var onChange = theTable.data('jqTable')['onChange'];
			if (onChange) {
				onChange.apply(theTable);
			}
			return value;
		}
		var newCell = $('<td>').editable(function(value, settings) {
			return value;
		}, options);
		// Handle keypress to navigate into the table
		newCell.keypress(function(e) {
			var code = e.keyCode ? e.keyCode : e.which;
			var cellToEditAfter = undefined;
			switch (code) {
			case 9: 
				if (e.shiftKey) { // backward tabulation
					// input -> form -> td -> previous td
					cellToEditAfter = e.target.parentNode.parentNode.previousSibling;
					if (cellToEditAfter === null) {
						var children = e.target.parentNode.parentNode.parentNode.previousSibling.children;
						cellToEditAfter = children[children.length-1]; 
					}
				} else { //  forward tabulation
					// input -> form -> td -> next td
					cellToEditAfter = e.target.parentNode.parentNode.nextSibling;
					if (cellToEditAfter === null) {
						// input -> form -> td -> tr -> next tr -> first td
						cellToEditAfter = e.target.parentNode.parentNode.parentNode.nextSibling.children[0];
					}
				}
				break;
			case 38: // handle up
				var thisIndex = getChildrenIndex(e.target.parentNode.parentNode);
				// input -> form -> td -> tr -> previous tr -> td with same index
				cellToEditAfter = e.target.parentNode.parentNode.parentNode.previousSibling.children[thisIndex];
				break;
			case 40: // handle down
				var thisIndex = getChildrenIndex(e.target.parentNode.parentNode);
				// input -> form -> td -> tr -> next tr -> td with same index
				cellToEditAfter = e.target.parentNode.parentNode.parentNode.nextSibling.children[thisIndex];
				break;
			}
			if (cellToEditAfter) {
				$(e.target).blur();
				$(cellToEditAfter).click();
				e.preventDefault();
			}
		});
		return newCell;
	}
	var methods = {
		init : function(options) {
			var colModels = options['colModel'];
			if (colModels) {
				var colIndex;
				for (colIndex in colModels) {
					var aColModel = colModels[colIndex];
					this.jqTable('addColumn', aColModel);
				}
				;
			}
			this.data('jqTable', options);
			return this;
		},
		getTHead : function() {
			// Get or create thead
			var theads = this.children('thead');
			if (theads.length == 0) {
				var newTHead = $('<thead>');
				theads = newTHead;
				this.append(newTHead);
			}
			return theads;
		},
		getTHeadRow : function() {
			var theads = this.jqTable('getTHead');
			// Get or create thead/tr
			var thRow = theads.children('tr');
			if (thRow.length == 0) {
				var newThRow = $('<tr>');
				thRow = newThRow;
				theads.append(newThRow);
			}
			return thRow;
		},
		getTBody : function() {
			// Get or create tbody
			var tbodies = this.children('tbody');
			if (tbodies.length == 0) {
				var newTBody = $('<tbody>');
				tbodies = newTBody;
				this.append(newTBody);
			}
			return tbodies;
		},
		addColumn : function addColumn(aColModel) {
			var thRow = this.jqTable('getTHeadRow');
			// Create thead/tr/th
			var colLabel = aColModel['label'] === undefined ? aColModel['name']
					: aColModel['label'];
			thRow.append($('<th>').append(colLabel));

			// Add td to all existing rows
			// but first assert tbody exist.
			var tbodies = this.jqTable('getTBody');
			var allTRs = tbodies.children('tr');
			if (allTRs.length != 0) {
				allTRs.append(makeNewEditableCell(this,
						this.data('jqTable')['editableOptions'], aColModel));
			}
			return this;
		},
		getColumnSize : function() {
			return this.jqTable('getTHeadRow').children('th').length;
		},
		addRow : function(someData) {
			var tbodies = this.jqTable('getTBody');
			var editableOptions = this.data('jqTable')['editableOptions'];
			if (Object.prototype.toString.call(someData) === '[object Array]') {
				var colIndex;
				var theColModel;
				var colModels = this.data('jqTable')['colModel'];
				var newRow = $('<tr>');
				for (colIndex in someData) {
					theColModel = colModels[colIndex];
					newRow.append(makeNewEditableCell(this, editableOptions,
							theColModel).html(someData[colIndex]));
				}
				var columnSize = this.jqTable('getColumnSize');
				if (colIndex === undefined) {
					colIndex = 0;
				} else {
					colIndex++;
				}
				for (; colIndex < columnSize; colIndex++) {
					theColModel = colModels[colIndex];
					newRow.append(makeNewEditableCell(this, editableOptions,
							theColModel));
				}
				tbodies.append(newRow);
			}
		},
		getColumnsName : function() {
			return this.data('jqTable')['colModel'].map(function(aColModel) {
				return aColModel['name'];
			});
		},
		getRowData : function() {
			var columns = this.jqTable('getColumnsName');
			var tbodies = this.jqTable('getTBody');
			var allTRs = tbodies.children('tr');
			var data = [];
			allTRs.each(function(index, value) {
				var row = {};
				$(value).children('td').each(function(childIndex, child) {
					row[columns[childIndex]] = $(child).text();
				});
				data.push(row);
			});
			return data;
		},
		toCSV : function() {
			var columns = this.jqTable('getColumnsName');
			var data = this.jqTable('getRowData');
			var csv = "";
			var i;
			for (i = 0; i < columns.length; i++) {
				csv += '"' + columns[i] + '"';
				if (i < columns.length - 1) {
					csv += ', ';
				}
			}
			csv += "\n";
			var row;
			var j;
			for (i = 0; i < data.length; i++) {
				row = data[i];
				for (j = 0; j < columns.length; j++) {
					csv += '"' + row[columns[j]] + '"';
					if (j < columns.length - 1) {
						csv += ', ';
					}
				}
				csv += "\n";
			}
			return csv;
		}
	}

	$.fn.jqTable = function(method) {
		if (methods[method]) {
			return methods[method].apply(this, Array.prototype.slice.call(
					arguments, 1));
		} else if (typeof method === 'object' || !method) {
			return methods.init.apply(this, arguments);
		} else {
			$.error('Method ' + method + ' does not exist on jQuery.jqTable');
		}
	}
})(jQuery)