(function(window, document, undefined){
	/*jshint eqnull:true */
	'use strict';

	if(!document.addEventListener){return;}

	var config, riasCfg;
	var replaceTypes = {string: 1, number: 1};
	var regNumber = /^\-*\+*\d+\.*\d*$/;
	var regPicture = /^picture$/i;
	var regWidth = /\s*\{\s*width\s*\}\s*/i;
	var regPlaceholder = /\s*\{\s*([a-z0-9]+)\s*\}\s*/ig;
	var regObj = /^\[.*\]|\{.*\}$/;
	var regAllowedSizes = /^(?:auto|\d+(px)?)$/;
	var anchor = document.createElement('a');

	(function(){
		var prop;
		var noop = function(){};
		var riasDefaults = {
			prefix: '',
			postfix: '',
			srcAttr: 'data-src',
			absUrl: false,
			modifyOptions: noop,
			widthmap: {}
		};

		config = (window.lazySizes && lazySizes.cfg) || window.lazySizesConfig;

		if(!config){
			config = {};
			window.lazySizesConfig = config;
		}

		if(!config.supportsType){
			config.supportsType = function(type/*, elem*/){
				return !type;
			};
		}

		if(!config.rias){
			config.rias = {};
		}
		riasCfg = config.rias;

		if(!('widths' in riasCfg)){
			riasCfg.widths = [];
			(function (widths){
				var width;
				var i = 0;
				widths.push(96);
				while(!width || width < 2800){
					i += 10;
					if(i > 60){
						i += 10;
					}
					width = (16 * i);
					widths.push(width);
				}
			})(riasCfg.widths);
		}

		for(prop in riasDefaults){
			if(!(prop in riasCfg)){
				riasCfg[prop] = riasDefaults[prop];
			}
		}
	})();

	function getElementOptions(elem, src){
		var attr, parent, setOption, options;


		parent = elem.parentNode;
		options = {
			isPicture: !!(parent && regPicture.test(parent.nodeName || ''))
		};

		setOption = function(attr, run){
			var attrVal = elem.getAttribute('data-'+ attr);

			if(attrVal != null){
				if(attrVal == 'true'){
					attrVal = true;
				} else if(attrVal == 'false'){
					attrVal = false;
				} else if(regNumber.test(attrVal)){
					attrVal = parseFloat(attrVal);
				} else if(typeof riasCfg[attr] == 'function'){
					attrVal = riasCfg[attr](elem, attrVal);
				} else if(regObj.test(attrVal)){
					try {
						attrVal = JSON.parse(attrVal);
					} catch(e){}
				}
				options[attr] = attrVal;
			} else if((attr in riasCfg) && typeof riasCfg[attr] != 'function'){
				options[attr] = riasCfg[attr];
			} else if(run && typeof riasCfg[attr] == 'function'){
				options[attr] = riasCfg[attr](elem, attrVal);
			}
		};

		for(attr in riasCfg){
			setOption(attr);
		}
		src.replace(regPlaceholder, function(full, match){
			if(!(match in options)){
				setOption(match, true);
			}
		});

		return options;
	}

	function replaceUrlProps(url, options){
		var candidates = [];
		var replaceFn = function(full, match){
			return (replaceTypes[typeof options[match]]) ? options[match] : full;
		};
		candidates.srcset = [];

		if(options.absUrl){
			anchor.setAttribute('href', url);
			url = anchor.href;
		}

		url = ((options.prefix || '') + url + (options.postfix || '')).replace(regPlaceholder, replaceFn);

		options.widths.forEach(function(width){
			var candidate = {
				u: url.replace(regWidth, options.widthmap[width] || width),
				w: width
			};

			candidates.push(candidate);
			candidates.srcset.push( (candidate.c = candidate.u + ' ' + width + 'w') );
		});
		return candidates;
	}

	function setSrc(src, opts, elem){

		if(!src){return;}

		src = replaceUrlProps(src, opts);

		src.isPicture = opts.isPicture;

		elem.setAttribute(config.srcsetAttr, src.srcset.join(', '));
		Object.defineProperty(elem, '_lazyrias', {
			value: src,
			writable: true
		});
	}

	function createAttrObject(elem, src){
		var opts = getElementOptions(elem, src);

		riasCfg.modifyOptions.call(elem, {target: elem, details: opts, detail: opts});

		lazySizes.fire(elem, 'lazyriasmodifyoptions', opts);
		return opts;
	}

	function getSrc(elem){
		return elem.getAttribute( elem.getAttribute('data-srcattr') || riasCfg.srcAttr ) || elem.getAttribute(config.srcsetAttr) || elem.getAttribute(config.srcAttr) || '';
	}

	addEventListener('lazybeforeunveil', function(e){
		var elem, src, elemOpts, parent, sources, i, len, sourceSrc, sizes, detail;
		elem = e.target;

		if(e.defaultPrevented || !(src = getSrc(elem)) || riasCfg.disabled || !((sizes = elem.getAttribute(config.sizesAttr) || elem.getAttribute('sizes')) && regAllowedSizes.test(sizes))){return;}

		elemOpts = createAttrObject(elem, src);

		if(regWidth.test(src) || regWidth.test(elemOpts.prefix) || regWidth.test(elemOpts.postfix)){
			if(elemOpts.isPicture && (parent = elem.parentNode)){
				sources = parent.getElementsByTagName('source');
				for(i = 0, len = sources.length; i < len; i++){
					sourceSrc = getSrc(sources[i]);
					setSrc(sourceSrc, elemOpts, sources[i]);
				}
			}

			setSrc(src, elemOpts, elem);
		}

		if(sizes != 'auto'){
			detail = {
				width: parseInt(sizes, 10)
			};
			polyfill({
				target: elem,
				detail: detail,
				details: detail
			});
		}

	});

	// partial polyfill
	var polyfill = (function(){
		var ascendingSort = function( a, b ) {
			return a.w - b.w;
		};

		var reduceCandidate = function (srces) {
			var lowerCandidate, upScaleThreshold;
			var len = srces.length;
			var candidate = srces[len -1];
			var i = 0;

			for(i; i < len;i++){
				candidate = srces[i];
				candidate.d = candidate.w / srces.w;
				if(candidate.d >= srces.d){
					lowerCandidate = srces[i - 1];

					if( lowerCandidate ) {
						upScaleThreshold = srces.d - (0.2 * Math.pow(srces.d, 1.8));

						if(lowerCandidate.d > upScaleThreshold &&
							lowerCandidate.d + ((candidate.d - srces.d) * Math.pow(lowerCandidate.d - 0.4, 1.3)) > srces.d){
							candidate = lowerCandidate;
						}
					}
					break;
				}
			}
			return candidate;
		};

		var getWSet = function(elem, testPicture){
			var src;
			if(!elem._lazyrias && lazySizes.pWS && (src = lazySizes.pWS(elem.getAttribute(config.srcsetAttr || ''))).length){
				Object.defineProperty(elem, '_lazyrias', {
					value: src,
					writable: true
				});
				if(testPicture && elem.parentNode){
					src.isPicture = elem.parentNode.nodeName.toUpperCase() == 'PICTURE';
				}
			}
			return elem._lazyrias;
		};

		var getX = function(elem){
			var dpr = window.devicePixelRatio || 1;
			var optimum = lazySizes.getX && lazySizes.getX(elem);
			return Math.min(optimum || dpr, 2.7, dpr);
		};

		var getCandidate = function(elem, width){
			var sources, i, len, media, srces;

			srces = elem._lazyrias;

			if(srces.isPicture && window.matchMedia){
				for(i = 0, sources = elem.parentNode.getElementsByTagName('source'), len = sources.length; i < len; i++){
					if(getWSet(sources[i]) && !sources[i].getAttribute('type') && ( !(media = sources[i].getAttribute('media')) || ((matchMedia(media) || {}).matches))){
						srces = sources[i]._lazyrias;
						break;
					}
				}
			}

			if(!srces.w || srces.w < width){
				srces.w = width;
			}
			srces.d = getX(elem);
			return reduceCandidate(srces.sort(ascendingSort));
		};

		var polyfill = function(e){
			var candidate;
			var elem = e.target;

			if(window.HTMLPictureElement || window.respimage || window.picturefill || lazySizesConfig.pf){
				document.removeEventListener('lazybeforesizes', polyfill);
				return;
			}

			if(!elem._lazyrias && (!e.detail.dataAttr || !getWSet(elem, true))){
				return;
			}

			candidate = getCandidate(elem, e.detail.width);

			if(candidate && candidate.u && elem._lazyrias.cur != candidate.u){
				elem._lazyrias.cur = candidate.u;
				elem.setAttribute(config.srcAttr, candidate.u);
				elem.setAttribute('src', candidate.u);
			}
		};

		document.addEventListener('lazybeforesizes', polyfill);

		return polyfill;

	})();

})(window, document);
