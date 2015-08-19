var blockTags = [ 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI' ];      

var p = Element.prototype;

p.matches = p.matches || p.matchesSelector ||
	p.msMatchesSelector || p.mozMatchesSelector ||
	p.webkitMatchesSelector || p.oMatchesSelector;

function isBlock(node) {
	return node.nodeType === 1 && blockTags.indexOf(node.tagName) !== -1;
	//return node.nodeType === 1 && !getComputedStyle(node).display.match(/inline/);
}

function getOffset(root, caret, countAll) {
	var rng = s().getRangeAt(0),
		ref = rng[(caret || 'start') + 'Container'],
		off = rng[(caret || 'start') + 'Offset'],
		tw = document.createTreeWalker(root, NodeFilter.SHOW_ALL, null, false),
		value = 0,
		last,
		node;

	while((node = tw.nextNode())) {
		var nodeType = tw.currentNode.nodeType;

		if(last && (isBlock(node) || countAll && !(nodeType === 1 && last === node.parentNode || last === node.previousSibling)))
			value++;

		if(node === ref) {
			value = value + off;
			break;
		}

		if(node.nodeType === 3)
			value = value + node.textContent.length;

		last = tw.currentNode;
	}

	return value;
}

function restore(root, offset, countAll) {
	var tw = document.createTreeWalker(root, NodeFilter.SHOW_ALL, null, false),
		last,
		node = tw.nextNode();

	while(offset > 0) {
		var nodetype = tw.currentNode.nodeType;

		if(last && (isBlock(node) || countAll && !(nodeType === 1 && last === node.parentNode || last === node.previousSibling)))
			offset--;

		if(node.nodeType === 3) {
			if(offset > node.textContent.length)
				offset = offset - node.textContent.length;
			else
				break;
		}

		last = tw.currentNode;
		// this was put inside loop to allow for empty elements
		node = tw.nextNode();
	}

	return {
		ref: node,
		offset: offset
	};
}

function position(ancestor, isStart, getRelativeToAncestor) {
	var rng = s().getRangeAt(0);
	var ref = isStart ? rng.startContainer : rng.endContainer;
	var offset = isStart ? rng.startOffset : rng.endOffset;

	if(ref.textContent.length !== 0) {
		var node = ref;
		if(isStart && offset === node.textContent.length) {
			while(node && node !== ancestor) {
				if(node.nextSibling) {
					ref = node.nextSibling;
					offset = 0;
					break;
				} else node = node.parentNode;
			}
		} else if(!isStart && !rng.collapsed && offset === 0) {
			while(node && node !== ancestor) {
				if(node.previousSibling) {
					//obj = relativeOffset(node.previousSibling, ancestor, node.previousSibling.textContent.length, isStart, getRelativeToAncestor, false);
					ref = node.previousSibling;
					offset = node.previousSibling.textContent.length;
					break;
				} else node = node.parentNode;
			}
		}
	}
	

	var isAtStart = offset === 0;

	if(ancestor) {
		var tmp = relativeOffset(ref, ancestor, offset, getRelativeToAncestor, false);
		ref = tmp.ref;
		offset = tmp.offset;
	}
	return { ref: ref, offset: offset, isAtStart: isAtStart };
}

// ufo can to be a nodeType (1 or 3) or a selector string
function descendants(element, ufo, levels) {
	// IE fix... IE will try to call filter property directly,
	// while good browsers (correctly) tries to call filter.acceptNode
	function filter(node) {
		return filters.every(function(fnc) {
			return fnc(node);
		}) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
	}

	var filters = [],
		nodeType,
		selector;

	filters.push(function(node) {
		for(var i = 0; i < levels; i++) {
			node = node.parentNode;
			if(node === element)
				return true;
		}

		// return false if levels is set and we have
		// made it through entire loop
		return !levels;
	});

	if(_.isString(ufo)) {
		selector = ufo;
		filters.push(function(node) {
			return node.matches(selector);
		});
	} else if(_.isNumber(ufo)) {
		nodeType = ufo;
	}

	switch((nodeType = nodeType || 1)) {
		case 1:
			filters.push(function(node) {
				return ['SCRIPT', 'STYLE'].indexOf(node.tagName) === -1;
			});
			whatToShow = NodeFilter.SHOW_ELEMENT;
			break;
		case 3:
			// TODO do we need to worry about textnodes that only contain whitespaces
			// and are adjacent to block elements.
			whatToShow = NodeFilter.SHOW_TEXT;
			break;
	}

	filter.acceptNode = filter;

	var tw = document.createTreeWalker(element, whatToShow, filter, false),
		nodes = [];

	while((node = tw.nextNode())) {
		nodes.push(node);
	}

	return nodes;
}

var s = window.getSelection;

module.exports = {
	restore: restore,

	getOffset: getOffset,
	
	contained: function(element, ufo, levels, partlyContained) {
		var _selectron = this,
			nodes = [];
			
		if(ufo instanceof NodeList)
			ufo = _.toArray(ufo);
			
		var check = _.isArray(ufo)? ufo : descendants(element, ufo, levels);

		check.forEach(function(node) {
			if(_selectron.contains(node, partlyContained))
				nodes.push(node);
		});

		return nodes;
	},

	contains: function(node, partlyContained) {
		// default, unoverridable behaviour of containsNode for textNodes
		if(node.nodeType === 3) partlyContained = true;

		var sel = s();

		if(sel.containsNode) {
			return sel.containsNode(node, partlyContained);
		} else {
			throw new Error('sel.containsNode not defined');
			//var rng = this.range();
			//var startOffset = relativeOffset(rng.startContainer, element, rng.startOffset, true, false).offset;
			//var endOffset = relativeOffset(rng.endContainer, element, rng.endOffset, true, false).offset;

			//for(var j = 0; j < checkNodes.length; j++) {
			//	var node = checkNodes[j];
			//	var currentStartOffset = relativeOffset(node, element, 0, true, false).offset;
			//	var currentEndOffset = relativeOffset(node, element, node.textContent.length, true, false).offset;

			//	if(
			//			(currentStartOffset >= startOffset && currentEndOffset <= endOffset) ||
			//			(!notPartlyContained && 
			//			 ((rng.collapsed && startOffset >= currentStartOffset && startOffset <= currentEndOffset) || 
			//				(startOffset > currentStartOffset && startOffset < currentEndOffset) ||
			//				(endOffset > currentStartOffset && endOffset < currentEndOffset)
			//				))) {
			//		if(notPartlyContained || 
			//				(endOffset !== currentStartOffset && startOffset !== currentEndOffset) ||
			//				(node.textContent.length === 0 || node.nodeType !== 1 || getComputedStyle(node).display.match(/inline/)) || 
			//				(rng.collapsed && (rng.startContainer.closest(node, element))))
			//			nodes.push(node);
			//	}
			//}
		}
	},

	normalize: function() {
		this.set(this.get());
	},

	isCollapsed: function() {
		return s().isCollapsed;
	},

	range: function() {
		var sel = s();

		if(sel.rangeCount > 0)
			return sel.getRangeAt(0);
		else
			return null;
	},

	get: function(element, countAll) {
		element = element || document.body;

		return {
			start: {
				ref: element,
				offset: getOffset(element, 'start', countAll)
			},
			end: {
				ref: element,
				offset: getOffset(element, 'end', countAll)
			}
		};
	},

	select: function(node) {
		var children = node.offspring();
		var first = children[0];
		var last = children[children.length - 1];
		this.set({
			start: { ref: first, offset: 0, isAtStart: true },
			end: { ref: last, offset: last.textContent.length, isAtStart: last.textContent.length === 0 }
		});
	},

	set: function(position) {
		if(position.ref) {
			position = {
				start: position
			};
		}

		var start = restore(position.start.ref, position.start.offset || 0),
			end = position.end ? restore(position.end.ref, position.end.offset) : start,
			rng = document.createRange(),
			sel = s();

		rng.setStart(start.ref, start.offset);
		rng.setEnd(end.ref, end.offset);

		sel.removeAllRanges();
		sel.addRange(rng);
	},

	oldset: function(position) {
		function recurse(node, offset, isStart) {
			if(!node) return null;
			var limit = isStart ? node.textContent.length - 1 : node.textContent.length;
			if(offset === 0 && node.textContent.length === 0)
				return { ref: node, offset: offset };
			else if(offset > limit && node.nextSibling)
				return recurse(node.nextSibling, offset - node.textContent.length, isStart);
			else if(node.firstChild)
				return recurse(node.firstChild, offset, isStart);
			else
				return { ref: node, offset: offset };
		}

		if(position.ref) {
			position = {
				start: position
			};
		}

		var start, end;
		//if(_.isObject(positions)) instanceof Positron) {
			start = recurse(position.start.ref, position.start.offset || 0, position.start.isAtStart);
			end = position.end ? recurse(position.end.ref, position.end.offset, position.end.isAtStart) : start;
		//} else if(ufo instanceof Node) {
		//	start = recurse(ufo, startOffset || 0);
		//	end = endNode instanceof Node ? recurse(endNode, endOffset || endNode.textContent.length) : start;
		//}

		var rng = document.createRange();
		rng.setStart(start.ref, start.offset);
		rng.setEnd(end.ref, end.offset);

		s().removeAllRanges();
		s().addRange(rng);
	},

	countRanges: function() {
		return s().rangeCount;
	}
};
