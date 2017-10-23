const Slate = require('slate');
const { List } = require('immutable');
const isList = require('../isList');
const getCurrentList = require('../getCurrentList')
const getCurrentItem = require('../getCurrentItem')

/**
 * Wrap the blocks in the current selection in a new list. Selected
 * lists are merged together.
 *
 * @param  {PluginOptions} opts
 * @param  {Slate.Change}
 * @param  {String?} type
 * @param  {Object|Data?} [data]
 * @return {Change}
 */
function wrapInList(opts, change, ordered, data) {
    const { state } = change
    const { document, selection } = change.state;
    const selectedBlocks = getHighestSelectedBlocks(state);
    const type = ordered || opts.types[0];

    // If we're wrapping a list inside another list, replace the type
    // of the list with the new list type. For example, if we call
    // wrapInList with 'ol_list', and we're inside a 'ul_list', replace
    // all the lists in the selection with 'ol_list'.
    const selectedLists = document.getBlocksAtRange(selection)
                                  .map((n) => getCurrentList(opts, state, n))
                                  .filter((n) => n);

    if (selectedLists.size !== 0) {
        change = selectedLists.reduce((change, list) => change.setNodeByKey(list.key, type), change);
    }

    // Wrap in container
    if (!selectedBlocks.every((node) => isPartOfList(opts, state, node))) {
        change.wrapBlock({
            type,
            data: Slate.Data.create(data)
        });
    }

    // Wrap in list items
    selectedBlocks.forEach((node) => {
        if (isList(opts, node)) {
            // Merge its items with the created list
            node.nodes.forEach(({ key }) => change.unwrapNodeByKey(key));
        } else if (!isPartOfList(opts, state, node)) {
            change.wrapBlockByKey(node.key, opts.typeItem);
        }
    });

    return change;
}

/**
 * Return true if node is a block inside a list item, a list item 
 * itself, or a list. False otherwise.
 *
 * @param {PluginOptions} opts
 * @param {Slate.State} state
 * @param {Slate.Block} block?
 * @return {Boolean} True if node or selection is inside a list (or a list itself)
 */
function isPartOfList(opts, state, node) {
  return (node.type === opts.typeItem) ||
         getCurrentItem(opts, state, node) ||
         getCurrentList(opts, state, node);
}

/**
 * @param  {Slate.State} state
 * @return {List<Block>} The highest list of blocks that cover the
 * current selection
 */
function getHighestSelectedBlocks(state) {
    const range = state.selection;
    const { document } = state;

    const startBlock = document.getClosestBlock(range.startKey);
    const endBlock = document.getClosestBlock(range.endKey);

    if (startBlock === endBlock) {
        return List([startBlock]);
    } else {
        const ancestor = document.getCommonAncestor(startBlock.key, endBlock.key);
        const startPath = ancestor.getPath(startBlock.key);
        const endPath = ancestor.getPath(endBlock.key);

        return ancestor.nodes.slice(startPath[0], endPath[0] + 1);
    }
}

module.exports = wrapInList;