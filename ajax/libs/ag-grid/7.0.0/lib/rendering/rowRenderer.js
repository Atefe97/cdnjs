/**
 * ag-grid - Advanced Data Grid / Data Table supporting Javascript / React / AngularJS / Web Components
 * @version v7.0.0
 * @link http://www.ag-grid.com/
 * @license MIT
 */
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var utils_1 = require("../utils");
var gridOptionsWrapper_1 = require("../gridOptionsWrapper");
var gridPanel_1 = require("../gridPanel/gridPanel");
var expressionService_1 = require("../expressionService");
var templateService_1 = require("../templateService");
var valueService_1 = require("../valueService");
var eventService_1 = require("../eventService");
var floatingRowModel_1 = require("../rowControllers/floatingRowModel");
var renderedRow_1 = require("./renderedRow");
var events_1 = require("../events");
var constants_1 = require("../constants");
var context_1 = require("../context/context");
var gridCore_1 = require("../gridCore");
var columnController_1 = require("../columnController/columnController");
var logger_1 = require("../logger");
var focusedCellController_1 = require("../focusedCellController");
var cellNavigationService_1 = require("../cellNavigationService");
var gridCell_1 = require("../entities/gridCell");
var RowRenderer = (function () {
    function RowRenderer() {
        // map of row ids to row objects. keeps track of which elements
        // are rendered for which rows in the dom.
        this.renderedRows = {};
        this.renderedTopFloatingRows = [];
        this.renderedBottomFloatingRows = [];
        // we only allow one refresh at a time, otherwise the internal memory structure here
        // will get messed up. this can happen if the user has a cellRenderer, and inside the
        // renderer they call an API method that results in another pass of the refresh,
        // then it will be trying to draw rows in the middle of a refresh.
        this.refreshInProgress = false;
        this.destroyFunctions = [];
    }
    RowRenderer.prototype.agWire = function (loggerFactory) {
        this.logger = this.loggerFactory.create('RowRenderer');
        this.logger = loggerFactory.create('BalancedColumnTreeBuilder');
    };
    RowRenderer.prototype.setupDocumentFragments = function () {
        var usingDocumentFragments = !!document.createDocumentFragment;
        if (usingDocumentFragments) {
            this.eBodyContainerDF = document.createDocumentFragment();
            if (!this.gridOptionsWrapper.isForPrint()) {
                this.ePinnedLeftColsContainerDF = document.createDocumentFragment();
                this.ePinnedRightColsContainerDF = document.createDocumentFragment();
            }
        }
    };
    RowRenderer.prototype.init = function () {
        var _this = this;
        this.getContainersFromGridPanel();
        this.setupDocumentFragments();
        var columnListener = this.onColumnEvent.bind(this);
        var modelUpdatedListener = this.onModelUpdated.bind(this);
        var floatingRowDataChangedListener = this.onFloatingRowDataChanged.bind(this);
        this.eventService.addEventListener(events_1.Events.EVENT_DISPLAYED_COLUMNS_CHANGED, columnListener);
        this.eventService.addEventListener(events_1.Events.EVENT_COLUMN_RESIZED, columnListener);
        this.eventService.addEventListener(events_1.Events.EVENT_MODEL_UPDATED, modelUpdatedListener);
        this.eventService.addEventListener(events_1.Events.EVENT_FLOATING_ROW_DATA_CHANGED, floatingRowDataChangedListener);
        this.destroyFunctions.push(function () {
            _this.eventService.removeEventListener(events_1.Events.EVENT_DISPLAYED_COLUMNS_CHANGED, columnListener);
            _this.eventService.removeEventListener(events_1.Events.EVENT_COLUMN_RESIZED, columnListener);
            _this.eventService.removeEventListener(events_1.Events.EVENT_MODEL_UPDATED, modelUpdatedListener);
            _this.eventService.removeEventListener(events_1.Events.EVENT_FLOATING_ROW_DATA_CHANGED, floatingRowDataChangedListener);
        });
        this.refreshView();
    };
    RowRenderer.prototype.onColumnEvent = function (event) {
        this.setMainRowWidths();
    };
    RowRenderer.prototype.getContainersFromGridPanel = function () {
        this.eFullWidthContainer = this.gridPanel.getFullWidthCellContainer();
        this.eBodyContainer = this.gridPanel.getBodyContainer();
        this.ePinnedLeftColsContainer = this.gridPanel.getPinnedLeftColsContainer();
        this.ePinnedRightColsContainer = this.gridPanel.getPinnedRightColsContainer();
        this.eFloatingTopContainer = this.gridPanel.getFloatingTopContainer();
        this.eFloatingTopPinnedLeftContainer = this.gridPanel.getPinnedLeftFloatingTop();
        this.eFloatingTopPinnedRightContainer = this.gridPanel.getPinnedRightFloatingTop();
        this.eFloatingTopFullWidthContainer = this.gridPanel.getFloatingTopFullWidthCellContainer();
        this.eFloatingBottomContainer = this.gridPanel.getFloatingBottomContainer();
        this.eFloatingBottomPinnedLeftContainer = this.gridPanel.getPinnedLeftFloatingBottom();
        this.eFloatingBottomPinnedRightContainer = this.gridPanel.getPinnedRightFloatingBottom();
        this.eFloatingBottomFullWithContainer = this.gridPanel.getFloatingBottomFullWidthCellContainer();
        this.eBodyViewport = this.gridPanel.getBodyViewport();
        this.eAllBodyContainers = [this.eBodyContainer, this.eFloatingBottomContainer,
            this.eFloatingTopContainer];
        this.eAllPinnedLeftContainers = [
            this.ePinnedLeftColsContainer,
            this.eFloatingBottomPinnedLeftContainer,
            this.eFloatingTopPinnedLeftContainer];
        this.eAllPinnedRightContainers = [
            this.ePinnedRightColsContainer,
            this.eFloatingBottomPinnedRightContainer,
            this.eFloatingTopPinnedRightContainer];
    };
    RowRenderer.prototype.setRowModel = function (rowModel) {
        this.rowModel = rowModel;
    };
    RowRenderer.prototype.getAllCellsForColumn = function (column) {
        var eCells = [];
        utils_1.Utils.iterateObject(this.renderedRows, callback);
        utils_1.Utils.iterateObject(this.renderedBottomFloatingRows, callback);
        utils_1.Utils.iterateObject(this.renderedTopFloatingRows, callback);
        function callback(key, renderedRow) {
            var eCell = renderedRow.getCellForCol(column);
            if (eCell) {
                eCells.push(eCell);
            }
        }
        return eCells;
    };
    RowRenderer.prototype.setMainRowWidths = function () {
        var mainRowWidth = this.columnController.getBodyContainerWidth() + "px";
        this.eAllBodyContainers.forEach(function (container) {
            var unpinnedRows = container.querySelectorAll(".ag-row");
            for (var i = 0; i < unpinnedRows.length; i++) {
                unpinnedRows[i].style.width = mainRowWidth;
            }
        });
    };
    RowRenderer.prototype.refreshAllFloatingRows = function () {
        this.refreshFloatingRows(this.renderedTopFloatingRows, this.floatingRowModel.getFloatingTopRowData(), this.eFloatingTopPinnedLeftContainer, this.eFloatingTopPinnedRightContainer, this.eFloatingTopContainer, this.eFloatingTopFullWidthContainer);
        this.refreshFloatingRows(this.renderedBottomFloatingRows, this.floatingRowModel.getFloatingBottomRowData(), this.eFloatingBottomPinnedLeftContainer, this.eFloatingBottomPinnedRightContainer, this.eFloatingBottomContainer, this.eFloatingBottomFullWithContainer);
    };
    RowRenderer.prototype.refreshFloatingRows = function (renderedRows, rowNodes, ePinnedLeftContainer, ePinnedRightContainer, eBodyContainer, eFullWidthContainer) {
        var _this = this;
        renderedRows.forEach(function (row) {
            row.destroy();
        });
        renderedRows.length = 0;
        // if no cols, don't draw row - can we get rid of this???
        var columns = this.columnController.getAllDisplayedColumns();
        if (utils_1.Utils.missingOrEmpty(columns)) {
            return;
        }
        if (rowNodes) {
            rowNodes.forEach(function (node, rowIndex) {
                var renderedRow = new renderedRow_1.RenderedRow(_this.$scope, _this, eBodyContainer, null, eFullWidthContainer, ePinnedLeftContainer, null, ePinnedRightContainer, null, node, false);
                _this.context.wireBean(renderedRow);
                renderedRows.push(renderedRow);
            });
        }
    };
    RowRenderer.prototype.onFloatingRowDataChanged = function () {
        this.refreshView();
    };
    RowRenderer.prototype.onModelUpdated = function (refreshEvent) {
        this.refreshView(refreshEvent.keepRenderedRows, refreshEvent.animate);
    };
    // if the row nodes are not rendered, no index is returned
    RowRenderer.prototype.getRenderedIndexsForRowNodes = function (rowNodes) {
        var result = [];
        if (utils_1.Utils.missing(rowNodes)) {
            return result;
        }
        utils_1.Utils.iterateObject(this.renderedRows, function (key, renderedRow) {
            var rowNode = renderedRow.getRowNode();
            if (rowNodes.indexOf(rowNode) >= 0) {
                result.push(key);
            }
        });
        return result;
    };
    RowRenderer.prototype.refreshRows = function (rowNodes) {
        if (!rowNodes || rowNodes.length == 0) {
            return;
        }
        // we only need to be worried about rendered rows, as this method is
        // called to whats rendered. if the row isn't rendered, we don't care
        var indexesToRemove = this.getRenderedIndexsForRowNodes(rowNodes);
        // remove the rows
        this.removeVirtualRows(indexesToRemove);
        // add draw them again
        this.refreshView(true, false);
    };
    RowRenderer.prototype.refreshView = function (keepRenderedRows, animate) {
        if (keepRenderedRows === void 0) { keepRenderedRows = false; }
        if (animate === void 0) { animate = false; }
        this.logger.log('refreshView');
        this.getLockOnRefresh();
        var focusedCell = this.focusedCellController.getFocusCellToUseAfterRefresh();
        if (!this.gridOptionsWrapper.isForPrint()) {
            var containerHeight = this.rowModel.getRowCombinedHeight();
            this.eBodyContainer.style.height = containerHeight + "px";
            this.eFullWidthContainer.style.height = containerHeight + "px";
            this.ePinnedLeftColsContainer.style.height = containerHeight + "px";
            this.ePinnedRightColsContainer.style.height = containerHeight + "px";
        }
        this.refreshAllVirtualRows(keepRenderedRows, animate);
        this.refreshAllFloatingRows();
        this.restoreFocusedCell(focusedCell);
        this.releaseLockOnRefresh();
    };
    RowRenderer.prototype.getLockOnRefresh = function () {
        if (this.refreshInProgress) {
            throw 'ag-Grid: cannot get grid to draw rows when it is in the middle of drawing rows. ' +
                'Your code probably called a grid API method while the grid was in the render stage. To overcome ' +
                'this, put the API call into a timeout, eg instead of api.refreshView(), ' +
                'call setTimeout(function(){api.refreshView(),0}). To see what part of your code ' +
                'that caused the refresh check this stacktrace.';
        }
        this.refreshInProgress = true;
    };
    RowRenderer.prototype.releaseLockOnRefresh = function () {
        this.refreshInProgress = false;
    };
    // sets the focus to the provided cell, if the cell is provided. this way, the user can call refresh without
    // worry about the focus been lost. this is important when the user is using keyboard navigation to do edits
    // and the cellEditor is calling 'refresh' to get other cells to update (as other cells might depend on the
    // edited cell).
    RowRenderer.prototype.restoreFocusedCell = function (gridCell) {
        if (gridCell) {
            this.focusedCellController.setFocusedCell(gridCell.rowIndex, gridCell.column, gridCell.floating, true);
        }
    };
    RowRenderer.prototype.softRefreshView = function () {
        var focusedCell = this.focusedCellController.getFocusCellToUseAfterRefresh();
        this.forEachRenderedCell(function (renderedCell) {
            if (renderedCell.isVolatile()) {
                renderedCell.refreshCell();
            }
        });
        this.restoreFocusedCell(focusedCell);
    };
    RowRenderer.prototype.stopEditing = function (cancel) {
        if (cancel === void 0) { cancel = false; }
        this.forEachRenderedRow(function (key, renderedRow) {
            renderedRow.stopEditing(cancel);
        });
    };
    RowRenderer.prototype.forEachRenderedCell = function (callback) {
        utils_1.Utils.iterateObject(this.renderedRows, function (key, renderedRow) {
            renderedRow.forEachRenderedCell(callback);
        });
    };
    RowRenderer.prototype.forEachRenderedRow = function (callback) {
        utils_1.Utils.iterateObject(this.renderedRows, callback);
        utils_1.Utils.iterateObject(this.renderedTopFloatingRows, callback);
        utils_1.Utils.iterateObject(this.renderedBottomFloatingRows, callback);
    };
    RowRenderer.prototype.addRenderedRowListener = function (eventName, rowIndex, callback) {
        var renderedRow = this.renderedRows[rowIndex];
        renderedRow.addEventListener(eventName, callback);
    };
    RowRenderer.prototype.refreshCells = function (rowNodes, colIds, animate) {
        if (animate === void 0) { animate = false; }
        if (!rowNodes || rowNodes.length == 0) {
            return;
        }
        // we only need to be worried about rendered rows, as this method is
        // called to whats rendered. if the row isn't rendered, we don't care
        utils_1.Utils.iterateObject(this.renderedRows, function (key, renderedRow) {
            var rowNode = renderedRow.getRowNode();
            if (rowNodes.indexOf(rowNode) >= 0) {
                renderedRow.refreshCells(colIds, animate);
            }
        });
    };
    RowRenderer.prototype.destroy = function () {
        this.destroyFunctions.forEach(function (func) { return func(); });
        var rowsToRemove = Object.keys(this.renderedRows);
        this.removeVirtualRows(rowsToRemove);
    };
    RowRenderer.prototype.refreshAllVirtualRows = function (keepRenderedRows, animate) {
        var _this = this;
        var rowsToRemove;
        var oldRowsByNodeId = {};
        if (keepRenderedRows) {
            rowsToRemove = [];
            utils_1.Utils.iterateObject(this.renderedRows, function (index, renderedRow) {
                var rowNode = renderedRow.getRowNode();
                if (utils_1.Utils.exists(rowNode.id)) {
                    oldRowsByNodeId[rowNode.id] = renderedRow;
                    delete _this.renderedRows[index];
                }
                else {
                    rowsToRemove.push(index);
                }
            });
        }
        else {
            rowsToRemove = Object.keys(this.renderedRows);
        }
        this.removeVirtualRows(rowsToRemove);
        this.drawVirtualRows(oldRowsByNodeId, animate);
    };
    // public - removes the group rows and then redraws them again
    RowRenderer.prototype.refreshGroupRows = function () {
        var _this = this;
        // find all the group rows
        var rowsToRemove = [];
        Object.keys(this.renderedRows).forEach(function (index) {
            var renderedRow = _this.renderedRows[index];
            if (renderedRow.isGroup()) {
                rowsToRemove.push(index);
            }
        });
        // remove the rows
        this.removeVirtualRows(rowsToRemove);
        // and draw them back again
        this.ensureRowsRendered();
    };
    // takes array of row indexes
    RowRenderer.prototype.removeVirtualRows = function (rowsToRemove) {
        var _this = this;
        // if no fromIndex then set to -1, which will refresh everything
        // var realFromIndex = -1;
        rowsToRemove.forEach(function (indexToRemove) {
            var renderedRow = _this.renderedRows[indexToRemove];
            renderedRow.destroy();
            delete _this.renderedRows[indexToRemove];
        });
    };
    // gets called when rows don't change, but viewport does, so after:
    // 1) size of grid changed
    // 2) grid scrolled to new position
    // 3) ensure index visible (which is a scroll)
    RowRenderer.prototype.drawVirtualRowsWithLock = function () {
        this.getLockOnRefresh();
        this.drawVirtualRows();
        this.releaseLockOnRefresh();
    };
    RowRenderer.prototype.drawVirtualRows = function (oldRowsByNodeId, animate) {
        if (animate === void 0) { animate = false; }
        this.workOutFirstAndLastRowsToRender();
        this.ensureRowsRendered(oldRowsByNodeId, animate);
    };
    RowRenderer.prototype.workOutFirstAndLastRowsToRender = function () {
        var newFirst;
        var newLast;
        if (!this.rowModel.isRowsToRender()) {
            newFirst = 0;
            newLast = -1; // setting to -1 means nothing in range
        }
        else {
            var rowCount = this.rowModel.getRowCount();
            if (this.gridOptionsWrapper.isForPrint()) {
                newFirst = 0;
                newLast = rowCount;
            }
            else {
                var topPixel = this.gridPanel.getBodyTopPixel();
                var bottomPixel = this.gridPanel.getBodyBottomPixel();
                var first = this.rowModel.getRowIndexAtPixel(topPixel);
                var last = this.rowModel.getRowIndexAtPixel(bottomPixel);
                //add in buffer
                var buffer = this.gridOptionsWrapper.getRowBuffer();
                first = first - buffer;
                last = last + buffer;
                // adjust, in case buffer extended actual size
                if (first < 0) {
                    first = 0;
                }
                if (last > rowCount - 1) {
                    last = rowCount - 1;
                }
                newFirst = first;
                newLast = last;
            }
        }
        var firstDiffers = newFirst !== this.firstRenderedRow;
        var lastDiffers = newLast !== this.lastRenderedRow;
        if (firstDiffers || lastDiffers) {
            this.firstRenderedRow = newFirst;
            this.lastRenderedRow = newLast;
            var event = { firstRow: newFirst, lastRow: newLast };
            this.eventService.dispatchEvent(events_1.Events.EVENT_VIEWPORT_CHANGED, event);
        }
    };
    RowRenderer.prototype.getFirstVirtualRenderedRow = function () {
        return this.firstRenderedRow;
    };
    RowRenderer.prototype.getLastVirtualRenderedRow = function () {
        return this.lastRenderedRow;
    };
    RowRenderer.prototype.ensureRowsRendered = function (oldRenderedRowsByNodeId, animate) {
        // var timer = new Timer();
        var _this = this;
        if (animate === void 0) { animate = false; }
        // at the end, this array will contain the items we need to remove
        var rowsToRemove = Object.keys(this.renderedRows);
        // add in new rows
        var delayedCreateFunctions = [];
        for (var rowIndex = this.firstRenderedRow; rowIndex <= this.lastRenderedRow; rowIndex++) {
            // see if item already there, and if yes, take it out of the 'to remove' array
            if (rowsToRemove.indexOf(rowIndex.toString()) >= 0) {
                rowsToRemove.splice(rowsToRemove.indexOf(rowIndex.toString()), 1);
                continue;
            }
            // check this row actually exists (in case overflow buffer window exceeds real data)
            var node = this.rowModel.getRow(rowIndex);
            if (node) {
                var renderedRow = this.getOrCreateRenderedRow(node, oldRenderedRowsByNodeId, animate);
                utils_1.Utils.pushAll(delayedCreateFunctions, renderedRow.getAndClearNextVMTurnFunctions());
                this.renderedRows[rowIndex] = renderedRow;
            }
        }
        setTimeout(function () {
            delayedCreateFunctions.forEach(function (func) { return func(); });
        }, 0);
        // timer.print('creating template');
        // at this point, everything in our 'rowsToRemove' is an old index that needs to be removed
        this.removeVirtualRows(rowsToRemove);
        // and everything in our oldRenderedRowsByNodeId is an old row that is no longer used
        var delayedDestroyFunctions = [];
        utils_1.Utils.iterateObject(oldRenderedRowsByNodeId, function (nodeId, renderedRow) {
            renderedRow.destroy(animate);
            renderedRow.getAndClearDelayedDestroyFunctions().forEach(function (func) { return delayedDestroyFunctions.push(func); });
            delete oldRenderedRowsByNodeId[nodeId];
        });
        setTimeout(function () {
            delayedDestroyFunctions.forEach(function (func) { return func(); });
        }, 400);
        // timer.print('removing');
        // we prepend rather than append so that new rows appear under current rows. this way the new
        // rows are not over the current rows which will get animation as they slid to new position
        if (this.eBodyContainerDF) {
            utils_1.Utils.prependDC(this.eBodyContainer, this.eBodyContainerDF);
            if (!this.gridOptionsWrapper.isForPrint()) {
                utils_1.Utils.prependDC(this.ePinnedLeftColsContainer, this.ePinnedLeftColsContainerDF);
                utils_1.Utils.prependDC(this.ePinnedRightColsContainer, this.ePinnedRightColsContainerDF);
            }
        }
        // if we are doing angular compiling, then do digest the scope here
        if (this.gridOptionsWrapper.isAngularCompileRows()) {
            // we do it in a timeout, in case we are already in an apply
            setTimeout(function () { _this.$scope.$apply(); }, 0);
        }
        // timer.print('total');
    };
    RowRenderer.prototype.getOrCreateRenderedRow = function (rowNode, oldRowsByNodeId, animate) {
        var renderedRow;
        if (utils_1.Utils.exists(oldRowsByNodeId) && oldRowsByNodeId[rowNode.id]) {
            renderedRow = oldRowsByNodeId[rowNode.id];
            delete oldRowsByNodeId[rowNode.id];
        }
        else {
            renderedRow = new renderedRow_1.RenderedRow(this.$scope, this, this.eBodyContainer, this.eBodyContainerDF, this.eFullWidthContainer, this.ePinnedLeftColsContainer, this.ePinnedLeftColsContainerDF, this.ePinnedRightColsContainer, this.ePinnedRightColsContainerDF, rowNode, animate);
            this.context.wireBean(renderedRow);
        }
        return renderedRow;
    };
    RowRenderer.prototype.getRenderedNodes = function () {
        var renderedRows = this.renderedRows;
        return Object.keys(renderedRows).map(function (key) {
            return renderedRows[key].getRowNode();
        });
    };
    // we use index for rows, but column object for columns, as the next column (by index) might not
    // be visible (header grouping) so it's not reliable, so using the column object instead.
    RowRenderer.prototype.navigateToNextCell = function (key, rowIndex, column, floating) {
        var nextCell = new gridCell_1.GridCell(rowIndex, floating, column);
        // we keep searching for a next cell until we find one. this is how the group rows get skipped
        while (true) {
            nextCell = this.cellNavigationService.getNextCellToFocus(key, nextCell);
            if (utils_1.Utils.missing(nextCell)) {
                break;
            }
            var skipGroupRows = this.gridOptionsWrapper.isGroupUseEntireRow();
            if (skipGroupRows) {
                var rowNode = this.rowModel.getRow(nextCell.rowIndex);
                if (!rowNode.group) {
                    break;
                }
            }
            else {
                break;
            }
        }
        // no next cell means we have reached a grid boundary, eg left, right, top or bottom of grid
        if (!nextCell) {
            return;
        }
        // this scrolls the row into view
        if (utils_1.Utils.missing(nextCell.floating)) {
            this.gridPanel.ensureIndexVisible(nextCell.rowIndex);
        }
        if (!nextCell.column.isPinned()) {
            this.gridPanel.ensureColumnVisible(nextCell.column);
        }
        // need to nudge the scrolls for the floating items. otherwise when we set focus on a non-visible
        // floating cell, the scrolls get out of sync
        this.gridPanel.horizontallyScrollHeaderCenterAndFloatingCenter();
        this.focusedCellController.setFocusedCell(nextCell.rowIndex, nextCell.column, nextCell.floating, true);
        if (this.rangeController) {
            this.rangeController.setRangeToCell(new gridCell_1.GridCell(nextCell.rowIndex, nextCell.floating, nextCell.column));
        }
    };
    RowRenderer.prototype.startEditingCell = function (gridCell, keyPress, charPress) {
        var cell = this.getComponentForCell(gridCell);
        cell.startRowOrCellEdit(keyPress, charPress);
    };
    RowRenderer.prototype.getComponentForCell = function (gridCell) {
        var rowComponent;
        switch (gridCell.floating) {
            case constants_1.Constants.FLOATING_TOP:
                rowComponent = this.renderedTopFloatingRows[gridCell.rowIndex];
                break;
            case constants_1.Constants.FLOATING_BOTTOM:
                rowComponent = this.renderedBottomFloatingRows[gridCell.rowIndex];
                break;
            default:
                rowComponent = this.renderedRows[gridCell.rowIndex];
                break;
        }
        if (!rowComponent) {
            return null;
        }
        var cellComponent = rowComponent.getRenderedCellForColumn(gridCell.column);
        return cellComponent;
    };
    RowRenderer.prototype.onTabKeyDown = function (previousRenderedCell, keyboardEvent) {
        var editing = previousRenderedCell.isEditing();
        var gridCell = previousRenderedCell.getGridCell();
        // find the next cell to start editing
        var nextRenderedCell = this.moveFocusToNextCell(gridCell, keyboardEvent.shiftKey, editing);
        var foundCell = utils_1.Utils.exists(nextRenderedCell);
        // only prevent default if we found a cell. so if user is on last cell and hits tab, then we default
        // to the normal tabbing so user can exit the grid.
        if (foundCell) {
            if (editing) {
                if (this.gridOptionsWrapper.isFullRowEdit()) {
                    this.moveEditToNextRow(previousRenderedCell, nextRenderedCell);
                }
                else {
                    this.moveEditToNextCell(previousRenderedCell, nextRenderedCell);
                }
            }
            else {
                nextRenderedCell.focusCell(true);
            }
            keyboardEvent.preventDefault();
        }
    };
    RowRenderer.prototype.moveEditToNextCell = function (previousRenderedCell, nextRenderedCell) {
        previousRenderedCell.stopEditing();
        nextRenderedCell.startEditingIfEnabled(null, null, true);
        nextRenderedCell.focusCell(false);
    };
    RowRenderer.prototype.moveEditToNextRow = function (previousRenderedCell, nextRenderedCell) {
        var pGridCell = previousRenderedCell.getGridCell();
        var nGridCell = nextRenderedCell.getGridCell();
        var rowsMatch = (pGridCell.rowIndex === nGridCell.rowIndex)
            && (pGridCell.floating === nGridCell.floating);
        if (rowsMatch) {
            // same row, so we don't start / stop editing, we just move the focus along
            previousRenderedCell.setFocusOutOnEditor();
            nextRenderedCell.setFocusInOnEditor();
        }
        else {
            var pRow = previousRenderedCell.getRenderedRow();
            var nRow = nextRenderedCell.getRenderedRow();
            previousRenderedCell.setFocusOutOnEditor();
            pRow.stopEditing();
            nRow.startRowEditing();
            nextRenderedCell.setFocusInOnEditor();
        }
        nextRenderedCell.focusCell();
    };
    // called by the cell, when tab is pressed while editing.
    // @return: RenderedCell when navigation successful, otherwise null
    RowRenderer.prototype.moveFocusToNextCell = function (gridCell, shiftKey, startEditing) {
        var nextCell = gridCell;
        while (true) {
            nextCell = this.cellNavigationService.getNextTabbedCell(nextCell, shiftKey);
            // if no 'next cell', means we have got to last cell of grid, so nothing to move to,
            // so bottom right cell going forwards, or top left going backwards
            if (!nextCell) {
                return null;
            }
            // this scrolls the row into view
            var cellIsNotFloating = utils_1.Utils.missing(nextCell.floating);
            if (cellIsNotFloating) {
                this.gridPanel.ensureIndexVisible(nextCell.rowIndex);
            }
            this.gridPanel.ensureColumnVisible(nextCell.column);
            // need to nudge the scrolls for the floating items. otherwise when we set focus on a non-visible
            // floating cell, the scrolls get out of sync
            this.gridPanel.horizontallyScrollHeaderCenterAndFloatingCenter();
            // we have to call this after ensureColumnVisible - otherwise it could be a virtual column
            // or row that is not currently in view, hence the renderedCell would not exist
            var nextRenderedCell = this.getComponentForCell(nextCell);
            // if editing, but cell not editable, skip cell
            if (startEditing && !nextRenderedCell.isCellEditable()) {
                continue;
            }
            if (nextRenderedCell.isSuppressNavigable()) {
                continue;
            }
            // by default, when we click a cell, it gets selected into a range, so to keep keyboard navigation
            // consistent, we set into range here also.
            if (this.rangeController) {
                this.rangeController.setRangeToCell(new gridCell_1.GridCell(nextCell.rowIndex, nextCell.floating, nextCell.column));
            }
            // we successfully tabbed onto a grid cell, so return true
            return nextRenderedCell;
        }
    };
    __decorate([
        context_1.Autowired('columnController'), 
        __metadata('design:type', columnController_1.ColumnController)
    ], RowRenderer.prototype, "columnController", void 0);
    __decorate([
        context_1.Autowired('gridOptionsWrapper'), 
        __metadata('design:type', gridOptionsWrapper_1.GridOptionsWrapper)
    ], RowRenderer.prototype, "gridOptionsWrapper", void 0);
    __decorate([
        context_1.Autowired('gridCore'), 
        __metadata('design:type', gridCore_1.GridCore)
    ], RowRenderer.prototype, "gridCore", void 0);
    __decorate([
        context_1.Autowired('gridPanel'), 
        __metadata('design:type', gridPanel_1.GridPanel)
    ], RowRenderer.prototype, "gridPanel", void 0);
    __decorate([
        context_1.Autowired('$compile'), 
        __metadata('design:type', Object)
    ], RowRenderer.prototype, "$compile", void 0);
    __decorate([
        context_1.Autowired('$scope'), 
        __metadata('design:type', Object)
    ], RowRenderer.prototype, "$scope", void 0);
    __decorate([
        context_1.Autowired('expressionService'), 
        __metadata('design:type', expressionService_1.ExpressionService)
    ], RowRenderer.prototype, "expressionService", void 0);
    __decorate([
        context_1.Autowired('templateService'), 
        __metadata('design:type', templateService_1.TemplateService)
    ], RowRenderer.prototype, "templateService", void 0);
    __decorate([
        context_1.Autowired('valueService'), 
        __metadata('design:type', valueService_1.ValueService)
    ], RowRenderer.prototype, "valueService", void 0);
    __decorate([
        context_1.Autowired('eventService'), 
        __metadata('design:type', eventService_1.EventService)
    ], RowRenderer.prototype, "eventService", void 0);
    __decorate([
        context_1.Autowired('floatingRowModel'), 
        __metadata('design:type', floatingRowModel_1.FloatingRowModel)
    ], RowRenderer.prototype, "floatingRowModel", void 0);
    __decorate([
        context_1.Autowired('context'), 
        __metadata('design:type', context_1.Context)
    ], RowRenderer.prototype, "context", void 0);
    __decorate([
        context_1.Autowired('loggerFactory'), 
        __metadata('design:type', logger_1.LoggerFactory)
    ], RowRenderer.prototype, "loggerFactory", void 0);
    __decorate([
        context_1.Autowired('rowModel'), 
        __metadata('design:type', Object)
    ], RowRenderer.prototype, "rowModel", void 0);
    __decorate([
        context_1.Autowired('focusedCellController'), 
        __metadata('design:type', focusedCellController_1.FocusedCellController)
    ], RowRenderer.prototype, "focusedCellController", void 0);
    __decorate([
        context_1.Optional('rangeController'), 
        __metadata('design:type', Object)
    ], RowRenderer.prototype, "rangeController", void 0);
    __decorate([
        context_1.Autowired('cellNavigationService'), 
        __metadata('design:type', cellNavigationService_1.CellNavigationService)
    ], RowRenderer.prototype, "cellNavigationService", void 0);
    __decorate([
        __param(0, context_1.Qualifier('loggerFactory')), 
        __metadata('design:type', Function), 
        __metadata('design:paramtypes', [logger_1.LoggerFactory]), 
        __metadata('design:returntype', void 0)
    ], RowRenderer.prototype, "agWire", null);
    __decorate([
        context_1.PostConstruct, 
        __metadata('design:type', Function), 
        __metadata('design:paramtypes', []), 
        __metadata('design:returntype', void 0)
    ], RowRenderer.prototype, "init", null);
    __decorate([
        context_1.PreDestroy, 
        __metadata('design:type', Function), 
        __metadata('design:paramtypes', []), 
        __metadata('design:returntype', void 0)
    ], RowRenderer.prototype, "destroy", null);
    RowRenderer = __decorate([
        context_1.Bean('rowRenderer'), 
        __metadata('design:paramtypes', [])
    ], RowRenderer);
    return RowRenderer;
}());
exports.RowRenderer = RowRenderer;
