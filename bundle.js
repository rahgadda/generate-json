var app = (function (Stream, http, Url, https, zlib) {
    'use strict';

    Stream = Stream && Object.prototype.hasOwnProperty.call(Stream, 'default') ? Stream['default'] : Stream;
    http = http && Object.prototype.hasOwnProperty.call(http, 'default') ? http['default'] : http;
    Url = Url && Object.prototype.hasOwnProperty.call(Url, 'default') ? Url['default'] : Url;
    https = https && Object.prototype.hasOwnProperty.call(https, 'default') ? https['default'] : https;
    zlib = zlib && Object.prototype.hasOwnProperty.call(zlib, 'default') ? zlib['default'] : zlib;

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.37.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function getUserAgent() {
        if (typeof navigator === "object" && "userAgent" in navigator) {
            return navigator.userAgent;
        }
        if (typeof process === "object" && "version" in process) {
            return `Node.js/${process.version.substr(1)} (${process.platform}; ${process.arch})`;
        }
        return "<environment undetectable>";
    }
    //# sourceMappingURL=index.js.map

    /*!
     * is-plain-object <https://github.com/jonschlinkert/is-plain-object>
     *
     * Copyright (c) 2014-2017, Jon Schlinkert.
     * Released under the MIT License.
     */

    function isObject(o) {
      return Object.prototype.toString.call(o) === '[object Object]';
    }

    function isPlainObject(o) {
      var ctor,prot;

      if (isObject(o) === false) return false;

      // If has modified constructor
      ctor = o.constructor;
      if (ctor === undefined) return true;

      // If has modified prototype
      prot = ctor.prototype;
      if (isObject(prot) === false) return false;

      // If constructor does not have an Object-specific method
      if (prot.hasOwnProperty('isPrototypeOf') === false) {
        return false;
      }

      // Most likely a plain Object
      return true;
    }

    function lowercaseKeys(object) {
        if (!object) {
            return {};
        }
        return Object.keys(object).reduce((newObj, key) => {
            newObj[key.toLowerCase()] = object[key];
            return newObj;
        }, {});
    }

    function mergeDeep(defaults, options) {
        const result = Object.assign({}, defaults);
        Object.keys(options).forEach((key) => {
            if (isPlainObject(options[key])) {
                if (!(key in defaults))
                    Object.assign(result, { [key]: options[key] });
                else
                    result[key] = mergeDeep(defaults[key], options[key]);
            }
            else {
                Object.assign(result, { [key]: options[key] });
            }
        });
        return result;
    }

    function removeUndefinedProperties(obj) {
        for (const key in obj) {
            if (obj[key] === undefined) {
                delete obj[key];
            }
        }
        return obj;
    }

    function merge(defaults, route, options) {
        if (typeof route === "string") {
            let [method, url] = route.split(" ");
            options = Object.assign(url ? { method, url } : { url: method }, options);
        }
        else {
            options = Object.assign({}, route);
        }
        // lowercase header names before merging with defaults to avoid duplicates
        options.headers = lowercaseKeys(options.headers);
        // remove properties with undefined values before merging
        removeUndefinedProperties(options);
        removeUndefinedProperties(options.headers);
        const mergedOptions = mergeDeep(defaults || {}, options);
        // mediaType.previews arrays are merged, instead of overwritten
        if (defaults && defaults.mediaType.previews.length) {
            mergedOptions.mediaType.previews = defaults.mediaType.previews
                .filter((preview) => !mergedOptions.mediaType.previews.includes(preview))
                .concat(mergedOptions.mediaType.previews);
        }
        mergedOptions.mediaType.previews = mergedOptions.mediaType.previews.map((preview) => preview.replace(/-preview/, ""));
        return mergedOptions;
    }

    function addQueryParameters(url, parameters) {
        const separator = /\?/.test(url) ? "&" : "?";
        const names = Object.keys(parameters);
        if (names.length === 0) {
            return url;
        }
        return (url +
            separator +
            names
                .map((name) => {
                if (name === "q") {
                    return ("q=" + parameters.q.split("+").map(encodeURIComponent).join("+"));
                }
                return `${name}=${encodeURIComponent(parameters[name])}`;
            })
                .join("&"));
    }

    const urlVariableRegex = /\{[^}]+\}/g;
    function removeNonChars(variableName) {
        return variableName.replace(/^\W+|\W+$/g, "").split(/,/);
    }
    function extractUrlVariableNames(url) {
        const matches = url.match(urlVariableRegex);
        if (!matches) {
            return [];
        }
        return matches.map(removeNonChars).reduce((a, b) => a.concat(b), []);
    }

    function omit(object, keysToOmit) {
        return Object.keys(object)
            .filter((option) => !keysToOmit.includes(option))
            .reduce((obj, key) => {
            obj[key] = object[key];
            return obj;
        }, {});
    }

    // Based on https://github.com/bramstein/url-template, licensed under BSD
    // TODO: create separate package.
    //
    // Copyright (c) 2012-2014, Bram Stein
    // All rights reserved.
    // Redistribution and use in source and binary forms, with or without
    // modification, are permitted provided that the following conditions
    // are met:
    //  1. Redistributions of source code must retain the above copyright
    //     notice, this list of conditions and the following disclaimer.
    //  2. Redistributions in binary form must reproduce the above copyright
    //     notice, this list of conditions and the following disclaimer in the
    //     documentation and/or other materials provided with the distribution.
    //  3. The name of the author may not be used to endorse or promote products
    //     derived from this software without specific prior written permission.
    // THIS SOFTWARE IS PROVIDED BY THE AUTHOR "AS IS" AND ANY EXPRESS OR IMPLIED
    // WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
    // MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO
    // EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
    // INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
    // BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
    // DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
    // OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
    // NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
    // EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
    /* istanbul ignore file */
    function encodeReserved(str) {
        return str
            .split(/(%[0-9A-Fa-f]{2})/g)
            .map(function (part) {
            if (!/%[0-9A-Fa-f]/.test(part)) {
                part = encodeURI(part).replace(/%5B/g, "[").replace(/%5D/g, "]");
            }
            return part;
        })
            .join("");
    }
    function encodeUnreserved(str) {
        return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
            return "%" + c.charCodeAt(0).toString(16).toUpperCase();
        });
    }
    function encodeValue(operator, value, key) {
        value =
            operator === "+" || operator === "#"
                ? encodeReserved(value)
                : encodeUnreserved(value);
        if (key) {
            return encodeUnreserved(key) + "=" + value;
        }
        else {
            return value;
        }
    }
    function isDefined(value) {
        return value !== undefined && value !== null;
    }
    function isKeyOperator(operator) {
        return operator === ";" || operator === "&" || operator === "?";
    }
    function getValues(context, operator, key, modifier) {
        var value = context[key], result = [];
        if (isDefined(value) && value !== "") {
            if (typeof value === "string" ||
                typeof value === "number" ||
                typeof value === "boolean") {
                value = value.toString();
                if (modifier && modifier !== "*") {
                    value = value.substring(0, parseInt(modifier, 10));
                }
                result.push(encodeValue(operator, value, isKeyOperator(operator) ? key : ""));
            }
            else {
                if (modifier === "*") {
                    if (Array.isArray(value)) {
                        value.filter(isDefined).forEach(function (value) {
                            result.push(encodeValue(operator, value, isKeyOperator(operator) ? key : ""));
                        });
                    }
                    else {
                        Object.keys(value).forEach(function (k) {
                            if (isDefined(value[k])) {
                                result.push(encodeValue(operator, value[k], k));
                            }
                        });
                    }
                }
                else {
                    const tmp = [];
                    if (Array.isArray(value)) {
                        value.filter(isDefined).forEach(function (value) {
                            tmp.push(encodeValue(operator, value));
                        });
                    }
                    else {
                        Object.keys(value).forEach(function (k) {
                            if (isDefined(value[k])) {
                                tmp.push(encodeUnreserved(k));
                                tmp.push(encodeValue(operator, value[k].toString()));
                            }
                        });
                    }
                    if (isKeyOperator(operator)) {
                        result.push(encodeUnreserved(key) + "=" + tmp.join(","));
                    }
                    else if (tmp.length !== 0) {
                        result.push(tmp.join(","));
                    }
                }
            }
        }
        else {
            if (operator === ";") {
                if (isDefined(value)) {
                    result.push(encodeUnreserved(key));
                }
            }
            else if (value === "" && (operator === "&" || operator === "?")) {
                result.push(encodeUnreserved(key) + "=");
            }
            else if (value === "") {
                result.push("");
            }
        }
        return result;
    }
    function parseUrl(template) {
        return {
            expand: expand.bind(null, template),
        };
    }
    function expand(template, context) {
        var operators = ["+", "#", ".", "/", ";", "?", "&"];
        return template.replace(/\{([^\{\}]+)\}|([^\{\}]+)/g, function (_, expression, literal) {
            if (expression) {
                let operator = "";
                const values = [];
                if (operators.indexOf(expression.charAt(0)) !== -1) {
                    operator = expression.charAt(0);
                    expression = expression.substr(1);
                }
                expression.split(/,/g).forEach(function (variable) {
                    var tmp = /([^:\*]*)(?::(\d+)|(\*))?/.exec(variable);
                    values.push(getValues(context, operator, tmp[1], tmp[2] || tmp[3]));
                });
                if (operator && operator !== "+") {
                    var separator = ",";
                    if (operator === "?") {
                        separator = "&";
                    }
                    else if (operator !== "#") {
                        separator = operator;
                    }
                    return (values.length !== 0 ? operator : "") + values.join(separator);
                }
                else {
                    return values.join(",");
                }
            }
            else {
                return encodeReserved(literal);
            }
        });
    }

    function parse(options) {
        // https://fetch.spec.whatwg.org/#methods
        let method = options.method.toUpperCase();
        // replace :varname with {varname} to make it RFC 6570 compatible
        let url = (options.url || "/").replace(/:([a-z]\w+)/g, "{$1}");
        let headers = Object.assign({}, options.headers);
        let body;
        let parameters = omit(options, [
            "method",
            "baseUrl",
            "url",
            "headers",
            "request",
            "mediaType",
        ]);
        // extract variable names from URL to calculate remaining variables later
        const urlVariableNames = extractUrlVariableNames(url);
        url = parseUrl(url).expand(parameters);
        if (!/^http/.test(url)) {
            url = options.baseUrl + url;
        }
        const omittedParameters = Object.keys(options)
            .filter((option) => urlVariableNames.includes(option))
            .concat("baseUrl");
        const remainingParameters = omit(parameters, omittedParameters);
        const isBinaryRequest = /application\/octet-stream/i.test(headers.accept);
        if (!isBinaryRequest) {
            if (options.mediaType.format) {
                // e.g. application/vnd.github.v3+json => application/vnd.github.v3.raw
                headers.accept = headers.accept
                    .split(/,/)
                    .map((preview) => preview.replace(/application\/vnd(\.\w+)(\.v3)?(\.\w+)?(\+json)?$/, `application/vnd$1$2.${options.mediaType.format}`))
                    .join(",");
            }
            if (options.mediaType.previews.length) {
                const previewsFromAcceptHeader = headers.accept.match(/[\w-]+(?=-preview)/g) || [];
                headers.accept = previewsFromAcceptHeader
                    .concat(options.mediaType.previews)
                    .map((preview) => {
                    const format = options.mediaType.format
                        ? `.${options.mediaType.format}`
                        : "+json";
                    return `application/vnd.github.${preview}-preview${format}`;
                })
                    .join(",");
            }
        }
        // for GET/HEAD requests, set URL query parameters from remaining parameters
        // for PATCH/POST/PUT/DELETE requests, set request body from remaining parameters
        if (["GET", "HEAD"].includes(method)) {
            url = addQueryParameters(url, remainingParameters);
        }
        else {
            if ("data" in remainingParameters) {
                body = remainingParameters.data;
            }
            else {
                if (Object.keys(remainingParameters).length) {
                    body = remainingParameters;
                }
                else {
                    headers["content-length"] = 0;
                }
            }
        }
        // default content-type for JSON if body is set
        if (!headers["content-type"] && typeof body !== "undefined") {
            headers["content-type"] = "application/json; charset=utf-8";
        }
        // GitHub expects 'content-length: 0' header for PUT/PATCH requests without body.
        // fetch does not allow to set `content-length` header, but we can set body to an empty string
        if (["PATCH", "PUT"].includes(method) && typeof body === "undefined") {
            body = "";
        }
        // Only return body/request keys if present
        return Object.assign({ method, url, headers }, typeof body !== "undefined" ? { body } : null, options.request ? { request: options.request } : null);
    }

    function endpointWithDefaults(defaults, route, options) {
        return parse(merge(defaults, route, options));
    }

    function withDefaults(oldDefaults, newDefaults) {
        const DEFAULTS = merge(oldDefaults, newDefaults);
        const endpoint = endpointWithDefaults.bind(null, DEFAULTS);
        return Object.assign(endpoint, {
            DEFAULTS,
            defaults: withDefaults.bind(null, DEFAULTS),
            merge: merge.bind(null, DEFAULTS),
            parse,
        });
    }

    const VERSION = "6.0.11";

    const userAgent = `octokit-endpoint.js/${VERSION} ${getUserAgent()}`;
    // DEFAULTS has all properties set that EndpointOptions has, except url.
    // So we use RequestParameters and add method as additional required property.
    const DEFAULTS = {
        method: "GET",
        baseUrl: "https://api.github.com",
        headers: {
            accept: "application/vnd.github.v3+json",
            "user-agent": userAgent,
        },
        mediaType: {
            format: "",
            previews: [],
        },
    };

    const endpoint = withDefaults(null, DEFAULTS);
    //# sourceMappingURL=index.js.map

    // Based on https://github.com/tmpvar/jsdom/blob/aa85b2abf07766ff7bf5c1f6daafb3726f2f2db5/lib/jsdom/living/blob.js

    // fix for "Readable" isn't a named export issue
    const Readable = Stream.Readable;

    const BUFFER = Symbol('buffer');
    const TYPE = Symbol('type');

    class Blob {
    	constructor() {
    		this[TYPE] = '';

    		const blobParts = arguments[0];
    		const options = arguments[1];

    		const buffers = [];
    		let size = 0;

    		if (blobParts) {
    			const a = blobParts;
    			const length = Number(a.length);
    			for (let i = 0; i < length; i++) {
    				const element = a[i];
    				let buffer;
    				if (element instanceof Buffer) {
    					buffer = element;
    				} else if (ArrayBuffer.isView(element)) {
    					buffer = Buffer.from(element.buffer, element.byteOffset, element.byteLength);
    				} else if (element instanceof ArrayBuffer) {
    					buffer = Buffer.from(element);
    				} else if (element instanceof Blob) {
    					buffer = element[BUFFER];
    				} else {
    					buffer = Buffer.from(typeof element === 'string' ? element : String(element));
    				}
    				size += buffer.length;
    				buffers.push(buffer);
    			}
    		}

    		this[BUFFER] = Buffer.concat(buffers);

    		let type = options && options.type !== undefined && String(options.type).toLowerCase();
    		if (type && !/[^\u0020-\u007E]/.test(type)) {
    			this[TYPE] = type;
    		}
    	}
    	get size() {
    		return this[BUFFER].length;
    	}
    	get type() {
    		return this[TYPE];
    	}
    	text() {
    		return Promise.resolve(this[BUFFER].toString());
    	}
    	arrayBuffer() {
    		const buf = this[BUFFER];
    		const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    		return Promise.resolve(ab);
    	}
    	stream() {
    		const readable = new Readable();
    		readable._read = function () {};
    		readable.push(this[BUFFER]);
    		readable.push(null);
    		return readable;
    	}
    	toString() {
    		return '[object Blob]';
    	}
    	slice() {
    		const size = this.size;

    		const start = arguments[0];
    		const end = arguments[1];
    		let relativeStart, relativeEnd;
    		if (start === undefined) {
    			relativeStart = 0;
    		} else if (start < 0) {
    			relativeStart = Math.max(size + start, 0);
    		} else {
    			relativeStart = Math.min(start, size);
    		}
    		if (end === undefined) {
    			relativeEnd = size;
    		} else if (end < 0) {
    			relativeEnd = Math.max(size + end, 0);
    		} else {
    			relativeEnd = Math.min(end, size);
    		}
    		const span = Math.max(relativeEnd - relativeStart, 0);

    		const buffer = this[BUFFER];
    		const slicedBuffer = buffer.slice(relativeStart, relativeStart + span);
    		const blob = new Blob([], { type: arguments[2] });
    		blob[BUFFER] = slicedBuffer;
    		return blob;
    	}
    }

    Object.defineProperties(Blob.prototype, {
    	size: { enumerable: true },
    	type: { enumerable: true },
    	slice: { enumerable: true }
    });

    Object.defineProperty(Blob.prototype, Symbol.toStringTag, {
    	value: 'Blob',
    	writable: false,
    	enumerable: false,
    	configurable: true
    });

    /**
     * fetch-error.js
     *
     * FetchError interface for operational errors
     */

    /**
     * Create FetchError instance
     *
     * @param   String      message      Error message for human
     * @param   String      type         Error type for machine
     * @param   String      systemError  For Node.js system error
     * @return  FetchError
     */
    function FetchError(message, type, systemError) {
      Error.call(this, message);

      this.message = message;
      this.type = type;

      // when err.type is `system`, err.code contains system error code
      if (systemError) {
        this.code = this.errno = systemError.code;
      }

      // hide custom error implementation details from end-users
      Error.captureStackTrace(this, this.constructor);
    }

    FetchError.prototype = Object.create(Error.prototype);
    FetchError.prototype.constructor = FetchError;
    FetchError.prototype.name = 'FetchError';

    let convert;
    try {
    	convert = require('encoding').convert;
    } catch (e) {}

    const INTERNALS = Symbol('Body internals');

    // fix an issue where "PassThrough" isn't a named export for node <10
    const PassThrough = Stream.PassThrough;

    /**
     * Body mixin
     *
     * Ref: https://fetch.spec.whatwg.org/#body
     *
     * @param   Stream  body  Readable stream
     * @param   Object  opts  Response options
     * @return  Void
     */
    function Body(body) {
    	var _this = this;

    	var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
    	    _ref$size = _ref.size;

    	let size = _ref$size === undefined ? 0 : _ref$size;
    	var _ref$timeout = _ref.timeout;
    	let timeout = _ref$timeout === undefined ? 0 : _ref$timeout;

    	if (body == null) {
    		// body is undefined or null
    		body = null;
    	} else if (isURLSearchParams(body)) {
    		// body is a URLSearchParams
    		body = Buffer.from(body.toString());
    	} else if (isBlob(body)) ; else if (Buffer.isBuffer(body)) ; else if (Object.prototype.toString.call(body) === '[object ArrayBuffer]') {
    		// body is ArrayBuffer
    		body = Buffer.from(body);
    	} else if (ArrayBuffer.isView(body)) {
    		// body is ArrayBufferView
    		body = Buffer.from(body.buffer, body.byteOffset, body.byteLength);
    	} else if (body instanceof Stream) ; else {
    		// none of the above
    		// coerce to string then buffer
    		body = Buffer.from(String(body));
    	}
    	this[INTERNALS] = {
    		body,
    		disturbed: false,
    		error: null
    	};
    	this.size = size;
    	this.timeout = timeout;

    	if (body instanceof Stream) {
    		body.on('error', function (err) {
    			const error = err.name === 'AbortError' ? err : new FetchError(`Invalid response body while trying to fetch ${_this.url}: ${err.message}`, 'system', err);
    			_this[INTERNALS].error = error;
    		});
    	}
    }

    Body.prototype = {
    	get body() {
    		return this[INTERNALS].body;
    	},

    	get bodyUsed() {
    		return this[INTERNALS].disturbed;
    	},

    	/**
      * Decode response as ArrayBuffer
      *
      * @return  Promise
      */
    	arrayBuffer() {
    		return consumeBody.call(this).then(function (buf) {
    			return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    		});
    	},

    	/**
      * Return raw response as Blob
      *
      * @return Promise
      */
    	blob() {
    		let ct = this.headers && this.headers.get('content-type') || '';
    		return consumeBody.call(this).then(function (buf) {
    			return Object.assign(
    			// Prevent copying
    			new Blob([], {
    				type: ct.toLowerCase()
    			}), {
    				[BUFFER]: buf
    			});
    		});
    	},

    	/**
      * Decode response as json
      *
      * @return  Promise
      */
    	json() {
    		var _this2 = this;

    		return consumeBody.call(this).then(function (buffer) {
    			try {
    				return JSON.parse(buffer.toString());
    			} catch (err) {
    				return Body.Promise.reject(new FetchError(`invalid json response body at ${_this2.url} reason: ${err.message}`, 'invalid-json'));
    			}
    		});
    	},

    	/**
      * Decode response as text
      *
      * @return  Promise
      */
    	text() {
    		return consumeBody.call(this).then(function (buffer) {
    			return buffer.toString();
    		});
    	},

    	/**
      * Decode response as buffer (non-spec api)
      *
      * @return  Promise
      */
    	buffer() {
    		return consumeBody.call(this);
    	},

    	/**
      * Decode response as text, while automatically detecting the encoding and
      * trying to decode to UTF-8 (non-spec api)
      *
      * @return  Promise
      */
    	textConverted() {
    		var _this3 = this;

    		return consumeBody.call(this).then(function (buffer) {
    			return convertBody(buffer, _this3.headers);
    		});
    	}
    };

    // In browsers, all properties are enumerable.
    Object.defineProperties(Body.prototype, {
    	body: { enumerable: true },
    	bodyUsed: { enumerable: true },
    	arrayBuffer: { enumerable: true },
    	blob: { enumerable: true },
    	json: { enumerable: true },
    	text: { enumerable: true }
    });

    Body.mixIn = function (proto) {
    	for (const name of Object.getOwnPropertyNames(Body.prototype)) {
    		// istanbul ignore else: future proof
    		if (!(name in proto)) {
    			const desc = Object.getOwnPropertyDescriptor(Body.prototype, name);
    			Object.defineProperty(proto, name, desc);
    		}
    	}
    };

    /**
     * Consume and convert an entire Body to a Buffer.
     *
     * Ref: https://fetch.spec.whatwg.org/#concept-body-consume-body
     *
     * @return  Promise
     */
    function consumeBody() {
    	var _this4 = this;

    	if (this[INTERNALS].disturbed) {
    		return Body.Promise.reject(new TypeError(`body used already for: ${this.url}`));
    	}

    	this[INTERNALS].disturbed = true;

    	if (this[INTERNALS].error) {
    		return Body.Promise.reject(this[INTERNALS].error);
    	}

    	let body = this.body;

    	// body is null
    	if (body === null) {
    		return Body.Promise.resolve(Buffer.alloc(0));
    	}

    	// body is blob
    	if (isBlob(body)) {
    		body = body.stream();
    	}

    	// body is buffer
    	if (Buffer.isBuffer(body)) {
    		return Body.Promise.resolve(body);
    	}

    	// istanbul ignore if: should never happen
    	if (!(body instanceof Stream)) {
    		return Body.Promise.resolve(Buffer.alloc(0));
    	}

    	// body is stream
    	// get ready to actually consume the body
    	let accum = [];
    	let accumBytes = 0;
    	let abort = false;

    	return new Body.Promise(function (resolve, reject) {
    		let resTimeout;

    		// allow timeout on slow response body
    		if (_this4.timeout) {
    			resTimeout = setTimeout(function () {
    				abort = true;
    				reject(new FetchError(`Response timeout while trying to fetch ${_this4.url} (over ${_this4.timeout}ms)`, 'body-timeout'));
    			}, _this4.timeout);
    		}

    		// handle stream errors
    		body.on('error', function (err) {
    			if (err.name === 'AbortError') {
    				// if the request was aborted, reject with this Error
    				abort = true;
    				reject(err);
    			} else {
    				// other errors, such as incorrect content-encoding
    				reject(new FetchError(`Invalid response body while trying to fetch ${_this4.url}: ${err.message}`, 'system', err));
    			}
    		});

    		body.on('data', function (chunk) {
    			if (abort || chunk === null) {
    				return;
    			}

    			if (_this4.size && accumBytes + chunk.length > _this4.size) {
    				abort = true;
    				reject(new FetchError(`content size at ${_this4.url} over limit: ${_this4.size}`, 'max-size'));
    				return;
    			}

    			accumBytes += chunk.length;
    			accum.push(chunk);
    		});

    		body.on('end', function () {
    			if (abort) {
    				return;
    			}

    			clearTimeout(resTimeout);

    			try {
    				resolve(Buffer.concat(accum, accumBytes));
    			} catch (err) {
    				// handle streams that have accumulated too much data (issue #414)
    				reject(new FetchError(`Could not create Buffer from response body for ${_this4.url}: ${err.message}`, 'system', err));
    			}
    		});
    	});
    }

    /**
     * Detect buffer encoding and convert to target encoding
     * ref: http://www.w3.org/TR/2011/WD-html5-20110113/parsing.html#determining-the-character-encoding
     *
     * @param   Buffer  buffer    Incoming buffer
     * @param   String  encoding  Target encoding
     * @return  String
     */
    function convertBody(buffer, headers) {
    	if (typeof convert !== 'function') {
    		throw new Error('The package `encoding` must be installed to use the textConverted() function');
    	}

    	const ct = headers.get('content-type');
    	let charset = 'utf-8';
    	let res, str;

    	// header
    	if (ct) {
    		res = /charset=([^;]*)/i.exec(ct);
    	}

    	// no charset in content type, peek at response body for at most 1024 bytes
    	str = buffer.slice(0, 1024).toString();

    	// html5
    	if (!res && str) {
    		res = /<meta.+?charset=(['"])(.+?)\1/i.exec(str);
    	}

    	// html4
    	if (!res && str) {
    		res = /<meta[\s]+?http-equiv=(['"])content-type\1[\s]+?content=(['"])(.+?)\2/i.exec(str);
    		if (!res) {
    			res = /<meta[\s]+?content=(['"])(.+?)\1[\s]+?http-equiv=(['"])content-type\3/i.exec(str);
    			if (res) {
    				res.pop(); // drop last quote
    			}
    		}

    		if (res) {
    			res = /charset=(.*)/i.exec(res.pop());
    		}
    	}

    	// xml
    	if (!res && str) {
    		res = /<\?xml.+?encoding=(['"])(.+?)\1/i.exec(str);
    	}

    	// found charset
    	if (res) {
    		charset = res.pop();

    		// prevent decode issues when sites use incorrect encoding
    		// ref: https://hsivonen.fi/encoding-menu/
    		if (charset === 'gb2312' || charset === 'gbk') {
    			charset = 'gb18030';
    		}
    	}

    	// turn raw buffers into a single utf-8 buffer
    	return convert(buffer, 'UTF-8', charset).toString();
    }

    /**
     * Detect a URLSearchParams object
     * ref: https://github.com/bitinn/node-fetch/issues/296#issuecomment-307598143
     *
     * @param   Object  obj     Object to detect by type or brand
     * @return  String
     */
    function isURLSearchParams(obj) {
    	// Duck-typing as a necessary condition.
    	if (typeof obj !== 'object' || typeof obj.append !== 'function' || typeof obj.delete !== 'function' || typeof obj.get !== 'function' || typeof obj.getAll !== 'function' || typeof obj.has !== 'function' || typeof obj.set !== 'function') {
    		return false;
    	}

    	// Brand-checking and more duck-typing as optional condition.
    	return obj.constructor.name === 'URLSearchParams' || Object.prototype.toString.call(obj) === '[object URLSearchParams]' || typeof obj.sort === 'function';
    }

    /**
     * Check if `obj` is a W3C `Blob` object (which `File` inherits from)
     * @param  {*} obj
     * @return {boolean}
     */
    function isBlob(obj) {
    	return typeof obj === 'object' && typeof obj.arrayBuffer === 'function' && typeof obj.type === 'string' && typeof obj.stream === 'function' && typeof obj.constructor === 'function' && typeof obj.constructor.name === 'string' && /^(Blob|File)$/.test(obj.constructor.name) && /^(Blob|File)$/.test(obj[Symbol.toStringTag]);
    }

    /**
     * Clone body given Res/Req instance
     *
     * @param   Mixed  instance  Response or Request instance
     * @return  Mixed
     */
    function clone(instance) {
    	let p1, p2;
    	let body = instance.body;

    	// don't allow cloning a used body
    	if (instance.bodyUsed) {
    		throw new Error('cannot clone body after it is used');
    	}

    	// check that body is a stream and not form-data object
    	// note: we can't clone the form-data object without having it as a dependency
    	if (body instanceof Stream && typeof body.getBoundary !== 'function') {
    		// tee instance body
    		p1 = new PassThrough();
    		p2 = new PassThrough();
    		body.pipe(p1);
    		body.pipe(p2);
    		// set instance body to teed body and return the other teed body
    		instance[INTERNALS].body = p1;
    		body = p2;
    	}

    	return body;
    }

    /**
     * Performs the operation "extract a `Content-Type` value from |object|" as
     * specified in the specification:
     * https://fetch.spec.whatwg.org/#concept-bodyinit-extract
     *
     * This function assumes that instance.body is present.
     *
     * @param   Mixed  instance  Any options.body input
     */
    function extractContentType(body) {
    	if (body === null) {
    		// body is null
    		return null;
    	} else if (typeof body === 'string') {
    		// body is string
    		return 'text/plain;charset=UTF-8';
    	} else if (isURLSearchParams(body)) {
    		// body is a URLSearchParams
    		return 'application/x-www-form-urlencoded;charset=UTF-8';
    	} else if (isBlob(body)) {
    		// body is blob
    		return body.type || null;
    	} else if (Buffer.isBuffer(body)) {
    		// body is buffer
    		return null;
    	} else if (Object.prototype.toString.call(body) === '[object ArrayBuffer]') {
    		// body is ArrayBuffer
    		return null;
    	} else if (ArrayBuffer.isView(body)) {
    		// body is ArrayBufferView
    		return null;
    	} else if (typeof body.getBoundary === 'function') {
    		// detect form data input from form-data module
    		return `multipart/form-data;boundary=${body.getBoundary()}`;
    	} else if (body instanceof Stream) {
    		// body is stream
    		// can't really do much about this
    		return null;
    	} else {
    		// Body constructor defaults other things to string
    		return 'text/plain;charset=UTF-8';
    	}
    }

    /**
     * The Fetch Standard treats this as if "total bytes" is a property on the body.
     * For us, we have to explicitly get it with a function.
     *
     * ref: https://fetch.spec.whatwg.org/#concept-body-total-bytes
     *
     * @param   Body    instance   Instance of Body
     * @return  Number?            Number of bytes, or null if not possible
     */
    function getTotalBytes(instance) {
    	const body = instance.body;


    	if (body === null) {
    		// body is null
    		return 0;
    	} else if (isBlob(body)) {
    		return body.size;
    	} else if (Buffer.isBuffer(body)) {
    		// body is buffer
    		return body.length;
    	} else if (body && typeof body.getLengthSync === 'function') {
    		// detect form data input from form-data module
    		if (body._lengthRetrievers && body._lengthRetrievers.length == 0 || // 1.x
    		body.hasKnownLength && body.hasKnownLength()) {
    			// 2.x
    			return body.getLengthSync();
    		}
    		return null;
    	} else {
    		// body is stream
    		return null;
    	}
    }

    /**
     * Write a Body to a Node.js WritableStream (e.g. http.Request) object.
     *
     * @param   Body    instance   Instance of Body
     * @return  Void
     */
    function writeToStream(dest, instance) {
    	const body = instance.body;


    	if (body === null) {
    		// body is null
    		dest.end();
    	} else if (isBlob(body)) {
    		body.stream().pipe(dest);
    	} else if (Buffer.isBuffer(body)) {
    		// body is buffer
    		dest.write(body);
    		dest.end();
    	} else {
    		// body is stream
    		body.pipe(dest);
    	}
    }

    // expose Promise
    Body.Promise = global.Promise;

    /**
     * headers.js
     *
     * Headers class offers convenient helpers
     */

    const invalidTokenRegex = /[^\^_`a-zA-Z\-0-9!#$%&'*+.|~]/;
    const invalidHeaderCharRegex = /[^\t\x20-\x7e\x80-\xff]/;

    function validateName(name) {
    	name = `${name}`;
    	if (invalidTokenRegex.test(name) || name === '') {
    		throw new TypeError(`${name} is not a legal HTTP header name`);
    	}
    }

    function validateValue(value) {
    	value = `${value}`;
    	if (invalidHeaderCharRegex.test(value)) {
    		throw new TypeError(`${value} is not a legal HTTP header value`);
    	}
    }

    /**
     * Find the key in the map object given a header name.
     *
     * Returns undefined if not found.
     *
     * @param   String  name  Header name
     * @return  String|Undefined
     */
    function find(map, name) {
    	name = name.toLowerCase();
    	for (const key in map) {
    		if (key.toLowerCase() === name) {
    			return key;
    		}
    	}
    	return undefined;
    }

    const MAP = Symbol('map');
    class Headers {
    	/**
      * Headers class
      *
      * @param   Object  headers  Response headers
      * @return  Void
      */
    	constructor() {
    		let init = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : undefined;

    		this[MAP] = Object.create(null);

    		if (init instanceof Headers) {
    			const rawHeaders = init.raw();
    			const headerNames = Object.keys(rawHeaders);

    			for (const headerName of headerNames) {
    				for (const value of rawHeaders[headerName]) {
    					this.append(headerName, value);
    				}
    			}

    			return;
    		}

    		// We don't worry about converting prop to ByteString here as append()
    		// will handle it.
    		if (init == null) ; else if (typeof init === 'object') {
    			const method = init[Symbol.iterator];
    			if (method != null) {
    				if (typeof method !== 'function') {
    					throw new TypeError('Header pairs must be iterable');
    				}

    				// sequence<sequence<ByteString>>
    				// Note: per spec we have to first exhaust the lists then process them
    				const pairs = [];
    				for (const pair of init) {
    					if (typeof pair !== 'object' || typeof pair[Symbol.iterator] !== 'function') {
    						throw new TypeError('Each header pair must be iterable');
    					}
    					pairs.push(Array.from(pair));
    				}

    				for (const pair of pairs) {
    					if (pair.length !== 2) {
    						throw new TypeError('Each header pair must be a name/value tuple');
    					}
    					this.append(pair[0], pair[1]);
    				}
    			} else {
    				// record<ByteString, ByteString>
    				for (const key of Object.keys(init)) {
    					const value = init[key];
    					this.append(key, value);
    				}
    			}
    		} else {
    			throw new TypeError('Provided initializer must be an object');
    		}
    	}

    	/**
      * Return combined header value given name
      *
      * @param   String  name  Header name
      * @return  Mixed
      */
    	get(name) {
    		name = `${name}`;
    		validateName(name);
    		const key = find(this[MAP], name);
    		if (key === undefined) {
    			return null;
    		}

    		return this[MAP][key].join(', ');
    	}

    	/**
      * Iterate over all headers
      *
      * @param   Function  callback  Executed for each item with parameters (value, name, thisArg)
      * @param   Boolean   thisArg   `this` context for callback function
      * @return  Void
      */
    	forEach(callback) {
    		let thisArg = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : undefined;

    		let pairs = getHeaders(this);
    		let i = 0;
    		while (i < pairs.length) {
    			var _pairs$i = pairs[i];
    			const name = _pairs$i[0],
    			      value = _pairs$i[1];

    			callback.call(thisArg, value, name, this);
    			pairs = getHeaders(this);
    			i++;
    		}
    	}

    	/**
      * Overwrite header values given name
      *
      * @param   String  name   Header name
      * @param   String  value  Header value
      * @return  Void
      */
    	set(name, value) {
    		name = `${name}`;
    		value = `${value}`;
    		validateName(name);
    		validateValue(value);
    		const key = find(this[MAP], name);
    		this[MAP][key !== undefined ? key : name] = [value];
    	}

    	/**
      * Append a value onto existing header
      *
      * @param   String  name   Header name
      * @param   String  value  Header value
      * @return  Void
      */
    	append(name, value) {
    		name = `${name}`;
    		value = `${value}`;
    		validateName(name);
    		validateValue(value);
    		const key = find(this[MAP], name);
    		if (key !== undefined) {
    			this[MAP][key].push(value);
    		} else {
    			this[MAP][name] = [value];
    		}
    	}

    	/**
      * Check for header name existence
      *
      * @param   String   name  Header name
      * @return  Boolean
      */
    	has(name) {
    		name = `${name}`;
    		validateName(name);
    		return find(this[MAP], name) !== undefined;
    	}

    	/**
      * Delete all header values given name
      *
      * @param   String  name  Header name
      * @return  Void
      */
    	delete(name) {
    		name = `${name}`;
    		validateName(name);
    		const key = find(this[MAP], name);
    		if (key !== undefined) {
    			delete this[MAP][key];
    		}
    	}

    	/**
      * Return raw headers (non-spec api)
      *
      * @return  Object
      */
    	raw() {
    		return this[MAP];
    	}

    	/**
      * Get an iterator on keys.
      *
      * @return  Iterator
      */
    	keys() {
    		return createHeadersIterator(this, 'key');
    	}

    	/**
      * Get an iterator on values.
      *
      * @return  Iterator
      */
    	values() {
    		return createHeadersIterator(this, 'value');
    	}

    	/**
      * Get an iterator on entries.
      *
      * This is the default iterator of the Headers object.
      *
      * @return  Iterator
      */
    	[Symbol.iterator]() {
    		return createHeadersIterator(this, 'key+value');
    	}
    }
    Headers.prototype.entries = Headers.prototype[Symbol.iterator];

    Object.defineProperty(Headers.prototype, Symbol.toStringTag, {
    	value: 'Headers',
    	writable: false,
    	enumerable: false,
    	configurable: true
    });

    Object.defineProperties(Headers.prototype, {
    	get: { enumerable: true },
    	forEach: { enumerable: true },
    	set: { enumerable: true },
    	append: { enumerable: true },
    	has: { enumerable: true },
    	delete: { enumerable: true },
    	keys: { enumerable: true },
    	values: { enumerable: true },
    	entries: { enumerable: true }
    });

    function getHeaders(headers) {
    	let kind = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'key+value';

    	const keys = Object.keys(headers[MAP]).sort();
    	return keys.map(kind === 'key' ? function (k) {
    		return k.toLowerCase();
    	} : kind === 'value' ? function (k) {
    		return headers[MAP][k].join(', ');
    	} : function (k) {
    		return [k.toLowerCase(), headers[MAP][k].join(', ')];
    	});
    }

    const INTERNAL = Symbol('internal');

    function createHeadersIterator(target, kind) {
    	const iterator = Object.create(HeadersIteratorPrototype);
    	iterator[INTERNAL] = {
    		target,
    		kind,
    		index: 0
    	};
    	return iterator;
    }

    const HeadersIteratorPrototype = Object.setPrototypeOf({
    	next() {
    		// istanbul ignore if
    		if (!this || Object.getPrototypeOf(this) !== HeadersIteratorPrototype) {
    			throw new TypeError('Value of `this` is not a HeadersIterator');
    		}

    		var _INTERNAL = this[INTERNAL];
    		const target = _INTERNAL.target,
    		      kind = _INTERNAL.kind,
    		      index = _INTERNAL.index;

    		const values = getHeaders(target, kind);
    		const len = values.length;
    		if (index >= len) {
    			return {
    				value: undefined,
    				done: true
    			};
    		}

    		this[INTERNAL].index = index + 1;

    		return {
    			value: values[index],
    			done: false
    		};
    	}
    }, Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]())));

    Object.defineProperty(HeadersIteratorPrototype, Symbol.toStringTag, {
    	value: 'HeadersIterator',
    	writable: false,
    	enumerable: false,
    	configurable: true
    });

    /**
     * Export the Headers object in a form that Node.js can consume.
     *
     * @param   Headers  headers
     * @return  Object
     */
    function exportNodeCompatibleHeaders(headers) {
    	const obj = Object.assign({ __proto__: null }, headers[MAP]);

    	// http.request() only supports string as Host header. This hack makes
    	// specifying custom Host header possible.
    	const hostHeaderKey = find(headers[MAP], 'Host');
    	if (hostHeaderKey !== undefined) {
    		obj[hostHeaderKey] = obj[hostHeaderKey][0];
    	}

    	return obj;
    }

    /**
     * Create a Headers object from an object of headers, ignoring those that do
     * not conform to HTTP grammar productions.
     *
     * @param   Object  obj  Object of headers
     * @return  Headers
     */
    function createHeadersLenient(obj) {
    	const headers = new Headers();
    	for (const name of Object.keys(obj)) {
    		if (invalidTokenRegex.test(name)) {
    			continue;
    		}
    		if (Array.isArray(obj[name])) {
    			for (const val of obj[name]) {
    				if (invalidHeaderCharRegex.test(val)) {
    					continue;
    				}
    				if (headers[MAP][name] === undefined) {
    					headers[MAP][name] = [val];
    				} else {
    					headers[MAP][name].push(val);
    				}
    			}
    		} else if (!invalidHeaderCharRegex.test(obj[name])) {
    			headers[MAP][name] = [obj[name]];
    		}
    	}
    	return headers;
    }

    const INTERNALS$1 = Symbol('Response internals');

    // fix an issue where "STATUS_CODES" aren't a named export for node <10
    const STATUS_CODES = http.STATUS_CODES;

    /**
     * Response class
     *
     * @param   Stream  body  Readable stream
     * @param   Object  opts  Response options
     * @return  Void
     */
    class Response {
    	constructor() {
    		let body = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    		let opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    		Body.call(this, body, opts);

    		const status = opts.status || 200;
    		const headers = new Headers(opts.headers);

    		if (body != null && !headers.has('Content-Type')) {
    			const contentType = extractContentType(body);
    			if (contentType) {
    				headers.append('Content-Type', contentType);
    			}
    		}

    		this[INTERNALS$1] = {
    			url: opts.url,
    			status,
    			statusText: opts.statusText || STATUS_CODES[status],
    			headers,
    			counter: opts.counter
    		};
    	}

    	get url() {
    		return this[INTERNALS$1].url || '';
    	}

    	get status() {
    		return this[INTERNALS$1].status;
    	}

    	/**
      * Convenience property representing if the request ended normally
      */
    	get ok() {
    		return this[INTERNALS$1].status >= 200 && this[INTERNALS$1].status < 300;
    	}

    	get redirected() {
    		return this[INTERNALS$1].counter > 0;
    	}

    	get statusText() {
    		return this[INTERNALS$1].statusText;
    	}

    	get headers() {
    		return this[INTERNALS$1].headers;
    	}

    	/**
      * Clone this response
      *
      * @return  Response
      */
    	clone() {
    		return new Response(clone(this), {
    			url: this.url,
    			status: this.status,
    			statusText: this.statusText,
    			headers: this.headers,
    			ok: this.ok,
    			redirected: this.redirected
    		});
    	}
    }

    Body.mixIn(Response.prototype);

    Object.defineProperties(Response.prototype, {
    	url: { enumerable: true },
    	status: { enumerable: true },
    	ok: { enumerable: true },
    	redirected: { enumerable: true },
    	statusText: { enumerable: true },
    	headers: { enumerable: true },
    	clone: { enumerable: true }
    });

    Object.defineProperty(Response.prototype, Symbol.toStringTag, {
    	value: 'Response',
    	writable: false,
    	enumerable: false,
    	configurable: true
    });

    const INTERNALS$2 = Symbol('Request internals');

    // fix an issue where "format", "parse" aren't a named export for node <10
    const parse_url = Url.parse;
    const format_url = Url.format;

    const streamDestructionSupported = 'destroy' in Stream.Readable.prototype;

    /**
     * Check if a value is an instance of Request.
     *
     * @param   Mixed   input
     * @return  Boolean
     */
    function isRequest(input) {
    	return typeof input === 'object' && typeof input[INTERNALS$2] === 'object';
    }

    function isAbortSignal(signal) {
    	const proto = signal && typeof signal === 'object' && Object.getPrototypeOf(signal);
    	return !!(proto && proto.constructor.name === 'AbortSignal');
    }

    /**
     * Request class
     *
     * @param   Mixed   input  Url or Request instance
     * @param   Object  init   Custom options
     * @return  Void
     */
    class Request {
    	constructor(input) {
    		let init = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    		let parsedURL;

    		// normalize input
    		if (!isRequest(input)) {
    			if (input && input.href) {
    				// in order to support Node.js' Url objects; though WHATWG's URL objects
    				// will fall into this branch also (since their `toString()` will return
    				// `href` property anyway)
    				parsedURL = parse_url(input.href);
    			} else {
    				// coerce input to a string before attempting to parse
    				parsedURL = parse_url(`${input}`);
    			}
    			input = {};
    		} else {
    			parsedURL = parse_url(input.url);
    		}

    		let method = init.method || input.method || 'GET';
    		method = method.toUpperCase();

    		if ((init.body != null || isRequest(input) && input.body !== null) && (method === 'GET' || method === 'HEAD')) {
    			throw new TypeError('Request with GET/HEAD method cannot have body');
    		}

    		let inputBody = init.body != null ? init.body : isRequest(input) && input.body !== null ? clone(input) : null;

    		Body.call(this, inputBody, {
    			timeout: init.timeout || input.timeout || 0,
    			size: init.size || input.size || 0
    		});

    		const headers = new Headers(init.headers || input.headers || {});

    		if (inputBody != null && !headers.has('Content-Type')) {
    			const contentType = extractContentType(inputBody);
    			if (contentType) {
    				headers.append('Content-Type', contentType);
    			}
    		}

    		let signal = isRequest(input) ? input.signal : null;
    		if ('signal' in init) signal = init.signal;

    		if (signal != null && !isAbortSignal(signal)) {
    			throw new TypeError('Expected signal to be an instanceof AbortSignal');
    		}

    		this[INTERNALS$2] = {
    			method,
    			redirect: init.redirect || input.redirect || 'follow',
    			headers,
    			parsedURL,
    			signal
    		};

    		// node-fetch-only options
    		this.follow = init.follow !== undefined ? init.follow : input.follow !== undefined ? input.follow : 20;
    		this.compress = init.compress !== undefined ? init.compress : input.compress !== undefined ? input.compress : true;
    		this.counter = init.counter || input.counter || 0;
    		this.agent = init.agent || input.agent;
    	}

    	get method() {
    		return this[INTERNALS$2].method;
    	}

    	get url() {
    		return format_url(this[INTERNALS$2].parsedURL);
    	}

    	get headers() {
    		return this[INTERNALS$2].headers;
    	}

    	get redirect() {
    		return this[INTERNALS$2].redirect;
    	}

    	get signal() {
    		return this[INTERNALS$2].signal;
    	}

    	/**
      * Clone this request
      *
      * @return  Request
      */
    	clone() {
    		return new Request(this);
    	}
    }

    Body.mixIn(Request.prototype);

    Object.defineProperty(Request.prototype, Symbol.toStringTag, {
    	value: 'Request',
    	writable: false,
    	enumerable: false,
    	configurable: true
    });

    Object.defineProperties(Request.prototype, {
    	method: { enumerable: true },
    	url: { enumerable: true },
    	headers: { enumerable: true },
    	redirect: { enumerable: true },
    	clone: { enumerable: true },
    	signal: { enumerable: true }
    });

    /**
     * Convert a Request to Node.js http request options.
     *
     * @param   Request  A Request instance
     * @return  Object   The options object to be passed to http.request
     */
    function getNodeRequestOptions(request) {
    	const parsedURL = request[INTERNALS$2].parsedURL;
    	const headers = new Headers(request[INTERNALS$2].headers);

    	// fetch step 1.3
    	if (!headers.has('Accept')) {
    		headers.set('Accept', '*/*');
    	}

    	// Basic fetch
    	if (!parsedURL.protocol || !parsedURL.hostname) {
    		throw new TypeError('Only absolute URLs are supported');
    	}

    	if (!/^https?:$/.test(parsedURL.protocol)) {
    		throw new TypeError('Only HTTP(S) protocols are supported');
    	}

    	if (request.signal && request.body instanceof Stream.Readable && !streamDestructionSupported) {
    		throw new Error('Cancellation of streamed requests with AbortSignal is not supported in node < 8');
    	}

    	// HTTP-network-or-cache fetch steps 2.4-2.7
    	let contentLengthValue = null;
    	if (request.body == null && /^(POST|PUT)$/i.test(request.method)) {
    		contentLengthValue = '0';
    	}
    	if (request.body != null) {
    		const totalBytes = getTotalBytes(request);
    		if (typeof totalBytes === 'number') {
    			contentLengthValue = String(totalBytes);
    		}
    	}
    	if (contentLengthValue) {
    		headers.set('Content-Length', contentLengthValue);
    	}

    	// HTTP-network-or-cache fetch step 2.11
    	if (!headers.has('User-Agent')) {
    		headers.set('User-Agent', 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)');
    	}

    	// HTTP-network-or-cache fetch step 2.15
    	if (request.compress && !headers.has('Accept-Encoding')) {
    		headers.set('Accept-Encoding', 'gzip,deflate');
    	}

    	let agent = request.agent;
    	if (typeof agent === 'function') {
    		agent = agent(parsedURL);
    	}

    	if (!headers.has('Connection') && !agent) {
    		headers.set('Connection', 'close');
    	}

    	// HTTP-network fetch step 4.2
    	// chunked encoding is handled by Node.js

    	return Object.assign({}, parsedURL, {
    		method: request.method,
    		headers: exportNodeCompatibleHeaders(headers),
    		agent
    	});
    }

    /**
     * abort-error.js
     *
     * AbortError interface for cancelled requests
     */

    /**
     * Create AbortError instance
     *
     * @param   String      message      Error message for human
     * @return  AbortError
     */
    function AbortError(message) {
      Error.call(this, message);

      this.type = 'aborted';
      this.message = message;

      // hide custom error implementation details from end-users
      Error.captureStackTrace(this, this.constructor);
    }

    AbortError.prototype = Object.create(Error.prototype);
    AbortError.prototype.constructor = AbortError;
    AbortError.prototype.name = 'AbortError';

    // fix an issue where "PassThrough", "resolve" aren't a named export for node <10
    const PassThrough$1 = Stream.PassThrough;
    const resolve_url = Url.resolve;

    /**
     * Fetch function
     *
     * @param   Mixed    url   Absolute url or Request instance
     * @param   Object   opts  Fetch options
     * @return  Promise
     */
    function fetch$1(url, opts) {

    	// allow custom promise
    	if (!fetch$1.Promise) {
    		throw new Error('native promise missing, set fetch.Promise to your favorite alternative');
    	}

    	Body.Promise = fetch$1.Promise;

    	// wrap http.request into fetch
    	return new fetch$1.Promise(function (resolve, reject) {
    		// build request object
    		const request = new Request(url, opts);
    		const options = getNodeRequestOptions(request);

    		const send = (options.protocol === 'https:' ? https : http).request;
    		const signal = request.signal;

    		let response = null;

    		const abort = function abort() {
    			let error = new AbortError('The user aborted a request.');
    			reject(error);
    			if (request.body && request.body instanceof Stream.Readable) {
    				request.body.destroy(error);
    			}
    			if (!response || !response.body) return;
    			response.body.emit('error', error);
    		};

    		if (signal && signal.aborted) {
    			abort();
    			return;
    		}

    		const abortAndFinalize = function abortAndFinalize() {
    			abort();
    			finalize();
    		};

    		// send request
    		const req = send(options);
    		let reqTimeout;

    		if (signal) {
    			signal.addEventListener('abort', abortAndFinalize);
    		}

    		function finalize() {
    			req.abort();
    			if (signal) signal.removeEventListener('abort', abortAndFinalize);
    			clearTimeout(reqTimeout);
    		}

    		if (request.timeout) {
    			req.once('socket', function (socket) {
    				reqTimeout = setTimeout(function () {
    					reject(new FetchError(`network timeout at: ${request.url}`, 'request-timeout'));
    					finalize();
    				}, request.timeout);
    			});
    		}

    		req.on('error', function (err) {
    			reject(new FetchError(`request to ${request.url} failed, reason: ${err.message}`, 'system', err));
    			finalize();
    		});

    		req.on('response', function (res) {
    			clearTimeout(reqTimeout);

    			const headers = createHeadersLenient(res.headers);

    			// HTTP fetch step 5
    			if (fetch$1.isRedirect(res.statusCode)) {
    				// HTTP fetch step 5.2
    				const location = headers.get('Location');

    				// HTTP fetch step 5.3
    				const locationURL = location === null ? null : resolve_url(request.url, location);

    				// HTTP fetch step 5.5
    				switch (request.redirect) {
    					case 'error':
    						reject(new FetchError(`uri requested responds with a redirect, redirect mode is set to error: ${request.url}`, 'no-redirect'));
    						finalize();
    						return;
    					case 'manual':
    						// node-fetch-specific step: make manual redirect a bit easier to use by setting the Location header value to the resolved URL.
    						if (locationURL !== null) {
    							// handle corrupted header
    							try {
    								headers.set('Location', locationURL);
    							} catch (err) {
    								// istanbul ignore next: nodejs server prevent invalid response headers, we can't test this through normal request
    								reject(err);
    							}
    						}
    						break;
    					case 'follow':
    						// HTTP-redirect fetch step 2
    						if (locationURL === null) {
    							break;
    						}

    						// HTTP-redirect fetch step 5
    						if (request.counter >= request.follow) {
    							reject(new FetchError(`maximum redirect reached at: ${request.url}`, 'max-redirect'));
    							finalize();
    							return;
    						}

    						// HTTP-redirect fetch step 6 (counter increment)
    						// Create a new Request object.
    						const requestOpts = {
    							headers: new Headers(request.headers),
    							follow: request.follow,
    							counter: request.counter + 1,
    							agent: request.agent,
    							compress: request.compress,
    							method: request.method,
    							body: request.body,
    							signal: request.signal,
    							timeout: request.timeout,
    							size: request.size
    						};

    						// HTTP-redirect fetch step 9
    						if (res.statusCode !== 303 && request.body && getTotalBytes(request) === null) {
    							reject(new FetchError('Cannot follow redirect with body being a readable stream', 'unsupported-redirect'));
    							finalize();
    							return;
    						}

    						// HTTP-redirect fetch step 11
    						if (res.statusCode === 303 || (res.statusCode === 301 || res.statusCode === 302) && request.method === 'POST') {
    							requestOpts.method = 'GET';
    							requestOpts.body = undefined;
    							requestOpts.headers.delete('content-length');
    						}

    						// HTTP-redirect fetch step 15
    						resolve(fetch$1(new Request(locationURL, requestOpts)));
    						finalize();
    						return;
    				}
    			}

    			// prepare response
    			res.once('end', function () {
    				if (signal) signal.removeEventListener('abort', abortAndFinalize);
    			});
    			let body = res.pipe(new PassThrough$1());

    			const response_options = {
    				url: request.url,
    				status: res.statusCode,
    				statusText: res.statusMessage,
    				headers: headers,
    				size: request.size,
    				timeout: request.timeout,
    				counter: request.counter
    			};

    			// HTTP-network fetch step 12.1.1.3
    			const codings = headers.get('Content-Encoding');

    			// HTTP-network fetch step 12.1.1.4: handle content codings

    			// in following scenarios we ignore compression support
    			// 1. compression support is disabled
    			// 2. HEAD request
    			// 3. no Content-Encoding header
    			// 4. no content response (204)
    			// 5. content not modified response (304)
    			if (!request.compress || request.method === 'HEAD' || codings === null || res.statusCode === 204 || res.statusCode === 304) {
    				response = new Response(body, response_options);
    				resolve(response);
    				return;
    			}

    			// For Node v6+
    			// Be less strict when decoding compressed responses, since sometimes
    			// servers send slightly invalid responses that are still accepted
    			// by common browsers.
    			// Always using Z_SYNC_FLUSH is what cURL does.
    			const zlibOptions = {
    				flush: zlib.Z_SYNC_FLUSH,
    				finishFlush: zlib.Z_SYNC_FLUSH
    			};

    			// for gzip
    			if (codings == 'gzip' || codings == 'x-gzip') {
    				body = body.pipe(zlib.createGunzip(zlibOptions));
    				response = new Response(body, response_options);
    				resolve(response);
    				return;
    			}

    			// for deflate
    			if (codings == 'deflate' || codings == 'x-deflate') {
    				// handle the infamous raw deflate response from old servers
    				// a hack for old IIS and Apache servers
    				const raw = res.pipe(new PassThrough$1());
    				raw.once('data', function (chunk) {
    					// see http://stackoverflow.com/questions/37519828
    					if ((chunk[0] & 0x0F) === 0x08) {
    						body = body.pipe(zlib.createInflate());
    					} else {
    						body = body.pipe(zlib.createInflateRaw());
    					}
    					response = new Response(body, response_options);
    					resolve(response);
    				});
    				return;
    			}

    			// for br
    			if (codings == 'br' && typeof zlib.createBrotliDecompress === 'function') {
    				body = body.pipe(zlib.createBrotliDecompress());
    				response = new Response(body, response_options);
    				resolve(response);
    				return;
    			}

    			// otherwise, use response as-is
    			response = new Response(body, response_options);
    			resolve(response);
    		});

    		writeToStream(req, request);
    	});
    }
    /**
     * Redirect code matching
     *
     * @param   Number   code  Status code
     * @return  Boolean
     */
    fetch$1.isRedirect = function (code) {
    	return code === 301 || code === 302 || code === 303 || code === 307 || code === 308;
    };

    // expose Promise
    fetch$1.Promise = global.Promise;

    class Deprecation extends Error {
      constructor(message) {
        super(message); // Maintains proper stack trace (only available on V8)

        /* istanbul ignore next */

        if (Error.captureStackTrace) {
          Error.captureStackTrace(this, this.constructor);
        }

        this.name = 'Deprecation';
      }

    }

    // Returns a wrapper function that returns a wrapped callback
    // The wrapper function should do some stuff, and return a
    // presumably different callback function.
    // This makes sure that own properties are retained, so that
    // decorations and such are not lost along the way.
    var wrappy_1 = wrappy;
    function wrappy (fn, cb) {
      if (fn && cb) return wrappy(fn)(cb)

      if (typeof fn !== 'function')
        throw new TypeError('need wrapper function')

      Object.keys(fn).forEach(function (k) {
        wrapper[k] = fn[k];
      });

      return wrapper

      function wrapper() {
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i];
        }
        var ret = fn.apply(this, args);
        var cb = args[args.length-1];
        if (typeof ret === 'function' && ret !== cb) {
          Object.keys(cb).forEach(function (k) {
            ret[k] = cb[k];
          });
        }
        return ret
      }
    }

    var once_1 = wrappy_1(once);
    var strict = wrappy_1(onceStrict);

    once.proto = once(function () {
      Object.defineProperty(Function.prototype, 'once', {
        value: function () {
          return once(this)
        },
        configurable: true
      });

      Object.defineProperty(Function.prototype, 'onceStrict', {
        value: function () {
          return onceStrict(this)
        },
        configurable: true
      });
    });

    function once (fn) {
      var f = function () {
        if (f.called) return f.value
        f.called = true;
        return f.value = fn.apply(this, arguments)
      };
      f.called = false;
      return f
    }

    function onceStrict (fn) {
      var f = function () {
        if (f.called)
          throw new Error(f.onceError)
        f.called = true;
        return f.value = fn.apply(this, arguments)
      };
      var name = fn.name || 'Function wrapped with `once`';
      f.onceError = name + " shouldn't be called more than once";
      f.called = false;
      return f
    }
    once_1.strict = strict;

    const logOnce = once_1((deprecation) => console.warn(deprecation));
    /**
     * Error with extra properties to help with debugging
     */
    class RequestError extends Error {
        constructor(message, statusCode, options) {
            super(message);
            // Maintains proper stack trace (only available on V8)
            /* istanbul ignore next */
            if (Error.captureStackTrace) {
                Error.captureStackTrace(this, this.constructor);
            }
            this.name = "HttpError";
            this.status = statusCode;
            Object.defineProperty(this, "code", {
                get() {
                    logOnce(new Deprecation("[@octokit/request-error] `error.code` is deprecated, use `error.status`."));
                    return statusCode;
                },
            });
            this.headers = options.headers || {};
            // redact request credentials without mutating original request options
            const requestCopy = Object.assign({}, options.request);
            if (options.request.headers.authorization) {
                requestCopy.headers = Object.assign({}, options.request.headers, {
                    authorization: options.request.headers.authorization.replace(/ .*$/, " [REDACTED]"),
                });
            }
            requestCopy.url = requestCopy.url
                // client_id & client_secret can be passed as URL query parameters to increase rate limit
                // see https://developer.github.com/v3/#increasing-the-unauthenticated-rate-limit-for-oauth-applications
                .replace(/\bclient_secret=\w+/g, "client_secret=[REDACTED]")
                // OAuth tokens can be passed as URL query parameters, although it is not recommended
                // see https://developer.github.com/v3/#oauth2-token-sent-in-a-header
                .replace(/\baccess_token=\w+/g, "access_token=[REDACTED]");
            this.request = requestCopy;
        }
    }
    //# sourceMappingURL=index.js.map

    var distWeb = /*#__PURE__*/Object.freeze({
        __proto__: null,
        RequestError: RequestError
    });

    const VERSION$1 = "5.4.15";

    function getBufferResponse(response) {
        return response.arrayBuffer();
    }

    function fetchWrapper(requestOptions) {
        if (isPlainObject(requestOptions.body) ||
            Array.isArray(requestOptions.body)) {
            requestOptions.body = JSON.stringify(requestOptions.body);
        }
        let headers = {};
        let status;
        let url;
        const fetch = (requestOptions.request && requestOptions.request.fetch) || fetch$1;
        return fetch(requestOptions.url, Object.assign({
            method: requestOptions.method,
            body: requestOptions.body,
            headers: requestOptions.headers,
            redirect: requestOptions.redirect,
        }, 
        // `requestOptions.request.agent` type is incompatible
        // see https://github.com/octokit/types.ts/pull/264
        requestOptions.request))
            .then((response) => {
            url = response.url;
            status = response.status;
            for (const keyAndValue of response.headers) {
                headers[keyAndValue[0]] = keyAndValue[1];
            }
            if (status === 204 || status === 205) {
                return;
            }
            // GitHub API returns 200 for HEAD requests
            if (requestOptions.method === "HEAD") {
                if (status < 400) {
                    return;
                }
                throw new RequestError(response.statusText, status, {
                    headers,
                    request: requestOptions,
                });
            }
            if (status === 304) {
                throw new RequestError("Not modified", status, {
                    headers,
                    request: requestOptions,
                });
            }
            if (status >= 400) {
                return response
                    .text()
                    .then((message) => {
                    const error = new RequestError(message, status, {
                        headers,
                        request: requestOptions,
                    });
                    try {
                        let responseBody = JSON.parse(error.message);
                        Object.assign(error, responseBody);
                        let errors = responseBody.errors;
                        // Assumption `errors` would always be in Array format
                        error.message =
                            error.message + ": " + errors.map(JSON.stringify).join(", ");
                    }
                    catch (e) {
                        // ignore, see octokit/rest.js#684
                    }
                    throw error;
                });
            }
            const contentType = response.headers.get("content-type");
            if (/application\/json/.test(contentType)) {
                return response.json();
            }
            if (!contentType || /^text\/|charset=utf-8$/.test(contentType)) {
                return response.text();
            }
            return getBufferResponse(response);
        })
            .then((data) => {
            return {
                status,
                url,
                headers,
                data,
            };
        })
            .catch((error) => {
            if (error instanceof RequestError) {
                throw error;
            }
            throw new RequestError(error.message, 500, {
                headers,
                request: requestOptions,
            });
        });
    }

    function withDefaults$1(oldEndpoint, newDefaults) {
        const endpoint = oldEndpoint.defaults(newDefaults);
        const newApi = function (route, parameters) {
            const endpointOptions = endpoint.merge(route, parameters);
            if (!endpointOptions.request || !endpointOptions.request.hook) {
                return fetchWrapper(endpoint.parse(endpointOptions));
            }
            const request = (route, parameters) => {
                return fetchWrapper(endpoint.parse(endpoint.merge(route, parameters)));
            };
            Object.assign(request, {
                endpoint,
                defaults: withDefaults$1.bind(null, endpoint),
            });
            return endpointOptions.request.hook(request, endpointOptions);
        };
        return Object.assign(newApi, {
            endpoint,
            defaults: withDefaults$1.bind(null, endpoint),
        });
    }

    const request = withDefaults$1(endpoint, {
        headers: {
            "user-agent": `octokit-request.js/${VERSION$1} ${getUserAgent()}`,
        },
    });
    //# sourceMappingURL=index.js.map

    var distWeb$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        request: request
    });

    var btoaNode = function btoa(str) {
      return new Buffer(str).toString('base64')
    };

    function unwrapExports (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    function oauthAuthorizationUrl(options) {
        const clientType = options.clientType || "oauth-app";
        const baseUrl = options.baseUrl || "https://github.com";
        const result = {
            clientType,
            allowSignup: options.allowSignup === false ? false : true,
            clientId: options.clientId,
            login: options.login || null,
            redirectUrl: options.redirectUrl || null,
            state: options.state || Math.random().toString(36).substr(2),
            url: "",
        };
        if (clientType === "oauth-app") {
            const scopes = "scopes" in options ? options.scopes : [];
            result.scopes =
                typeof scopes === "string"
                    ? scopes.split(/[,\s]+/).filter(Boolean)
                    : scopes;
        }
        result.url = urlBuilderAuthorize(`${baseUrl}/login/oauth/authorize`, result);
        return result;
    }
    function urlBuilderAuthorize(base, options) {
        const map = {
            allowSignup: "allow_signup",
            clientId: "client_id",
            login: "login",
            redirectUrl: "redirect_uri",
            scopes: "scope",
            state: "state",
        };
        let url = base;
        Object.keys(map)
            // Filter out keys that are null and remove the url key
            .filter((k) => options[k] !== null)
            // Filter out empty scopes array
            .filter((k) => {
            if (k !== "scopes")
                return true;
            if (options.clientType === "github-app")
                return false;
            return !Array.isArray(options[k]) || options[k].length > 0;
        })
            // Map Array with the proper URL parameter names and change the value to a string using template strings
            // @ts-ignore
            .map((key) => [map[key], `${options[key]}`])
            // Finally, build the URL
            .forEach(([key, value], index) => {
            url += index === 0 ? `?` : "&";
            url += `${key}=${value}`;
        });
        return url;
    }
    //# sourceMappingURL=index.js.map

    var distWeb$2 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        oauthAuthorizationUrl: oauthAuthorizationUrl
    });

    var distNode = createCommonjsModule(function (module, exports) {

    Object.defineProperty(exports, '__esModule', { value: true });

    function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }




    var btoa = _interopDefault(btoaNode);

    const VERSION = "1.2.2";

    function _defineProperty(obj, key, value) {
      if (key in obj) {
        Object.defineProperty(obj, key, {
          value: value,
          enumerable: true,
          configurable: true,
          writable: true
        });
      } else {
        obj[key] = value;
      }

      return obj;
    }

    function ownKeys(object, enumerableOnly) {
      var keys = Object.keys(object);

      if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        if (enumerableOnly) symbols = symbols.filter(function (sym) {
          return Object.getOwnPropertyDescriptor(object, sym).enumerable;
        });
        keys.push.apply(keys, symbols);
      }

      return keys;
    }

    function _objectSpread2(target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i] != null ? arguments[i] : {};

        if (i % 2) {
          ownKeys(Object(source), true).forEach(function (key) {
            _defineProperty(target, key, source[key]);
          });
        } else if (Object.getOwnPropertyDescriptors) {
          Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
        } else {
          ownKeys(Object(source)).forEach(function (key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
          });
        }
      }

      return target;
    }

    function _objectWithoutPropertiesLoose(source, excluded) {
      if (source == null) return {};
      var target = {};
      var sourceKeys = Object.keys(source);
      var key, i;

      for (i = 0; i < sourceKeys.length; i++) {
        key = sourceKeys[i];
        if (excluded.indexOf(key) >= 0) continue;
        target[key] = source[key];
      }

      return target;
    }

    function _objectWithoutProperties(source, excluded) {
      if (source == null) return {};

      var target = _objectWithoutPropertiesLoose(source, excluded);

      var key, i;

      if (Object.getOwnPropertySymbols) {
        var sourceSymbolKeys = Object.getOwnPropertySymbols(source);

        for (i = 0; i < sourceSymbolKeys.length; i++) {
          key = sourceSymbolKeys[i];
          if (excluded.indexOf(key) >= 0) continue;
          if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
          target[key] = source[key];
        }
      }

      return target;
    }

    function requestToOAuthBaseUrl(request) {
      const endpointDefaults = request.endpoint.DEFAULTS;
      return /^https:\/\/(api\.)?github\.com$/.test(endpointDefaults.baseUrl) ? "https://github.com" : endpointDefaults.baseUrl.replace("/api/v3", "");
    }
    async function oauthRequest(request, route, parameters) {
      const withOAuthParameters = _objectSpread2({
        baseUrl: requestToOAuthBaseUrl(request),
        headers: {
          accept: "application/json"
        }
      }, parameters);

      const response = await request(route, withOAuthParameters);

      if ("error" in response.data) {
        const error = new distWeb.RequestError(`${response.data.error_description} (${response.data.error}, ${response.data.error_url})`, 400, {
          request: request.endpoint.merge(route, withOAuthParameters),
          headers: response.headers
        }); // @ts-ignore add custom response property until https://github.com/octokit/request-error.js/issues/169 is resolved

        error.response = response;
        throw error;
      }

      return response;
    }

    function getWebFlowAuthorizationUrl(_ref) {
      let {
        request: request$1 = distWeb$1.request
      } = _ref,
          options = _objectWithoutProperties(_ref, ["request"]);

      const baseUrl = requestToOAuthBaseUrl(request$1); // @ts-expect-error TypeScript wants `clientType` to be set explicitly ¯\_(ツ)_/¯

      return distWeb$2.oauthAuthorizationUrl(_objectSpread2(_objectSpread2({}, options), {}, {
        baseUrl
      }));
    }

    async function exchangeWebFlowCode(options) {
      const request$1 = options.request ||
      /* istanbul ignore next: we always pass a custom request in tests */
      distWeb$1.request;
      const response = await oauthRequest(request$1, "POST /login/oauth/access_token", {
        client_id: options.clientId,
        client_secret: options.clientSecret,
        code: options.code,
        redirect_uri: options.redirectUrl,
        state: options.state
      });
      const authentication = {
        clientType: options.clientType,
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        token: response.data.access_token,
        scopes: response.data.scope.split(/\s+/).filter(Boolean)
      };

      if (options.clientType === "github-app") {
        if ("refresh_token" in response.data) {
          const apiTimeInMs = new Date(response.headers.date).getTime();
          authentication.refreshToken = response.data.refresh_token, authentication.expiresAt = toTimestamp(apiTimeInMs, response.data.expires_in), authentication.refreshTokenExpiresAt = toTimestamp(apiTimeInMs, response.data.refresh_token_expires_in);
        }

        delete authentication.scopes;
      }

      return _objectSpread2(_objectSpread2({}, response), {}, {
        authentication
      });
    }

    function toTimestamp(apiTimeInMs, expirationInSeconds) {
      return new Date(apiTimeInMs + expirationInSeconds * 1000).toISOString();
    }

    async function createDeviceCode(options) {
      const request$1 = options.request ||
      /* istanbul ignore next: we always pass a custom request in tests */
      distWeb$1.request;
      const parameters = {
        client_id: options.clientId
      };

      if ("scopes" in options && Array.isArray(options.scopes)) {
        parameters.scope = options.scopes.join(" ");
      }

      return oauthRequest(request$1, "POST /login/device/code", parameters);
    }

    async function exchangeDeviceCode(options) {
      const request$1 = options.request ||
      /* istanbul ignore next: we always pass a custom request in tests */
      distWeb$1.request;
      const response = await oauthRequest(request$1, "POST /login/oauth/access_token", {
        client_id: options.clientId,
        device_code: options.code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code"
      });
      const authentication = {
        clientType: options.clientType,
        clientId: options.clientId,
        token: response.data.access_token,
        scopes: response.data.scope.split(/\s+/).filter(Boolean)
      };

      if ("clientSecret" in options) {
        authentication.clientSecret = options.clientSecret;
      }

      if (options.clientType === "github-app") {
        if ("refresh_token" in response.data) {
          const apiTimeInMs = new Date(response.headers.date).getTime();
          authentication.refreshToken = response.data.refresh_token, authentication.expiresAt = toTimestamp$1(apiTimeInMs, response.data.expires_in), authentication.refreshTokenExpiresAt = toTimestamp$1(apiTimeInMs, response.data.refresh_token_expires_in);
        }

        delete authentication.scopes;
      }

      return _objectSpread2(_objectSpread2({}, response), {}, {
        authentication
      });
    }

    function toTimestamp$1(apiTimeInMs, expirationInSeconds) {
      return new Date(apiTimeInMs + expirationInSeconds * 1000).toISOString();
    }

    async function checkToken(options) {
      const request$1 = options.request ||
      /* istanbul ignore next: we always pass a custom request in tests */
      distWeb$1.request;
      const response = await request$1("POST /applications/{client_id}/token", {
        headers: {
          authorization: `basic ${btoa(`${options.clientId}:${options.clientSecret}`)}`
        },
        client_id: options.clientId,
        access_token: options.token
      });
      const authentication = {
        clientType: options.clientType,
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        token: options.token,
        scopes: response.data.scopes
      };

      if (options.clientType === "github-app") {
        delete authentication.scopes;
      }

      return _objectSpread2(_objectSpread2({}, response), {}, {
        authentication
      });
    }

    async function refreshToken(options) {
      const request$1 = options.request ||
      /* istanbul ignore next: we always pass a custom request in tests */
      distWeb$1.request;
      const response = await oauthRequest(request$1, "POST /login/oauth/access_token", {
        client_id: options.clientId,
        client_secret: options.clientSecret,
        grant_type: "refresh_token",
        refresh_token: options.refreshToken
      });
      const apiTimeInMs = new Date(response.headers.date).getTime();
      const authentication = {
        clientType: "github-app",
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        token: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: toTimestamp$2(apiTimeInMs, response.data.expires_in),
        refreshTokenExpiresAt: toTimestamp$2(apiTimeInMs, response.data.refresh_token_expires_in)
      };
      return _objectSpread2(_objectSpread2({}, response), {}, {
        authentication
      });
    }

    function toTimestamp$2(apiTimeInMs, expirationInSeconds) {
      return new Date(apiTimeInMs + expirationInSeconds * 1000).toISOString();
    }

    async function scopeToken(options) {
      const {
        request: request$1,
        clientType,
        clientId,
        clientSecret,
        token
      } = options,
            requestOptions = _objectWithoutProperties(options, ["request", "clientType", "clientId", "clientSecret", "token"]);

      const response = await (request$1 ||
      /* istanbul ignore next: we always pass a custom request in tests */
      distWeb$1.request)("POST /applications/{client_id}/token/scoped", _objectSpread2({
        headers: {
          authorization: `basic ${btoa(`${clientId}:${clientSecret}`)}`
        },
        client_id: clientId,
        access_token: token
      }, requestOptions));
      const authentication = {
        clientType,
        clientId,
        clientSecret,
        token: response.data.token
      };
      return _objectSpread2(_objectSpread2({}, response), {}, {
        authentication
      });
    }

    async function resetToken(options) {
      const request$1 = options.request ||
      /* istanbul ignore next: we always pass a custom request in tests */
      distWeb$1.request;
      const auth = btoa(`${options.clientId}:${options.clientSecret}`);
      const response = await request$1("PATCH /applications/{client_id}/token", {
        headers: {
          authorization: `basic ${auth}`
        },
        client_id: options.clientId,
        access_token: options.token
      });
      const authentication = {
        clientType: options.clientType,
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        token: response.data.token,
        scopes: response.data.scopes
      };

      if (options.clientType === "github-app") {
        delete authentication.scopes;
      }

      return _objectSpread2(_objectSpread2({}, response), {}, {
        authentication
      });
    }

    async function deleteToken(options) {
      const request$1 = options.request ||
      /* istanbul ignore next: we always pass a custom request in tests */
      distWeb$1.request;
      const auth = btoa(`${options.clientId}:${options.clientSecret}`);
      return request$1("DELETE /applications/{client_id}/token", {
        headers: {
          authorization: `basic ${auth}`
        },
        client_id: options.clientId,
        access_token: options.token
      });
    }

    async function deleteAuthorization(options) {
      const request$1 = options.request ||
      /* istanbul ignore next: we always pass a custom request in tests */
      distWeb$1.request;
      const auth = btoa(`${options.clientId}:${options.clientSecret}`);
      return request$1("DELETE /applications/{client_id}/grant", {
        headers: {
          authorization: `basic ${auth}`
        },
        client_id: options.clientId,
        access_token: options.token
      });
    }

    exports.VERSION = VERSION;
    exports.checkToken = checkToken;
    exports.createDeviceCode = createDeviceCode;
    exports.deleteAuthorization = deleteAuthorization;
    exports.deleteToken = deleteToken;
    exports.exchangeDeviceCode = exchangeDeviceCode;
    exports.exchangeWebFlowCode = exchangeWebFlowCode;
    exports.getWebFlowAuthorizationUrl = getWebFlowAuthorizationUrl;
    exports.refreshToken = refreshToken;
    exports.resetToken = resetToken;
    exports.scopeToken = scopeToken;
    //# sourceMappingURL=index.js.map
    });

    unwrapExports(distNode);
    var distNode_1 = distNode.VERSION;
    var distNode_2 = distNode.checkToken;
    var distNode_3 = distNode.createDeviceCode;
    var distNode_4 = distNode.deleteAuthorization;
    var distNode_5 = distNode.deleteToken;
    var distNode_6 = distNode.exchangeDeviceCode;
    var distNode_7 = distNode.exchangeWebFlowCode;
    var distNode_8 = distNode.getWebFlowAuthorizationUrl;
    var distNode_9 = distNode.refreshToken;
    var distNode_10 = distNode.resetToken;
    var distNode_11 = distNode.scopeToken;

    async function getOAuthAccessToken(state, options) {
        const cachedAuthentication = getCachedAuthentication(state, options.auth);
        if (cachedAuthentication)
            return cachedAuthentication;
        // Step 1: Request device and user codes
        // https://docs.github.com/en/developers/apps/authorizing-oauth-apps#step-1-app-requests-the-device-and-user-verification-codes-from-github
        const { data: verification } = await distNode_3({
            clientType: state.clientType,
            clientId: state.clientId,
            request: options.request || state.request,
            // @ts-expect-error the extra code to make TS happy is not worth it
            scopes: options.auth.scopes || state.scopes,
        });
        // Step 2: User must enter the user code on https://github.com/login/device
        // See https://docs.github.com/en/developers/apps/authorizing-oauth-apps#step-2-prompt-the-user-to-enter-the-user-code-in-a-browser
        await state.onVerification(verification);
        // Step 3: Exchange device code for access token
        // See https://docs.github.com/en/developers/apps/authorizing-oauth-apps#step-3-app-polls-github-to-check-if-the-user-authorized-the-device
        const authentication = await waitForAccessToken(options.request || state.request, state.clientId, state.clientType, verification);
        state.authentication = authentication;
        return authentication;
    }
    function getCachedAuthentication(state, auth) {
        if (auth.refresh === true)
            return false;
        if (!state.authentication)
            return false;
        if (state.clientType === "github-app") {
            return state.authentication;
        }
        const authentication = state.authentication;
        const newScope = (("scopes" in auth && auth.scopes) || state.scopes).join(" ");
        const currentScope = authentication.scopes.join(" ");
        return newScope === currentScope ? authentication : false;
    }
    async function wait(seconds) {
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    }
    async function waitForAccessToken(request, clientId, clientType, verification) {
        try {
            const options = {
                clientId,
                request,
                code: verification.device_code,
            };
            // WHY TYPESCRIPT WHY ARE YOU DOING THIS TO ME
            const { authentication } = clientType === "oauth-app"
                ? await distNode_6({
                    ...options,
                    clientType: "oauth-app",
                })
                : await distNode_6({
                    ...options,
                    clientType: "github-app",
                });
            return {
                type: "token",
                tokenType: "oauth",
                ...authentication,
            };
        }
        catch (error) {
            // istanbul ignore if
            if (!error.response)
                throw error;
            const errorType = error.response.data.error;
            if (errorType === "authorization_pending") {
                await wait(verification.interval);
                return waitForAccessToken(request, clientId, clientType, verification);
            }
            if (errorType === "slow_down") {
                await wait(verification.interval + 5);
                return waitForAccessToken(request, clientId, clientType, verification);
            }
            throw error;
        }
    }

    async function auth(state, authOptions) {
        return getOAuthAccessToken(state, {
            auth: authOptions,
        });
    }

    async function hook(state, request, route, parameters) {
        let endpoint = request.endpoint.merge(route, parameters);
        // Do not intercept request to retrieve codes or token
        if (/\/login\/(oauth\/access_token|device\/code)$/.test(endpoint.url)) {
            return request(endpoint);
        }
        const { token } = await getOAuthAccessToken(state, {
            request,
            auth: { type: "oauth" },
        });
        endpoint.headers.authorization = `token ${token}`;
        return request(endpoint);
    }

    const VERSION$2 = "3.1.1";

    function createOAuthDeviceAuth(options) {
        const requestWithDefaults = options.request ||
            request.defaults({
                headers: {
                    "user-agent": `octokit-auth-oauth-device.js/${VERSION$2} ${getUserAgent()}`,
                },
            });
        const { request: request$1 = requestWithDefaults, ...otherOptions } = options;
        const state = options.clientType === "github-app"
            ? {
                ...otherOptions,
                clientType: "github-app",
                request: request$1,
            }
            : {
                ...otherOptions,
                clientType: "oauth-app",
                request: request$1,
                scopes: options.scopes || [],
            };
        if (!options.clientId) {
            throw new Error('[@octokit/auth-oauth-device] "clientId" option must be set (https://github.com/octokit/auth-oauth-device.js#usage)');
        }
        if (!options.onVerification) {
            throw new Error('[@octokit/auth-oauth-device] "onVerification" option must be a function (https://github.com/octokit/auth-oauth-device.js#usage)');
        }
        // @ts-ignore too much for tsc / ts-jest ¯\_(ツ)_/¯
        return Object.assign(auth.bind(null, state), {
            hook: hook.bind(null, state),
        });
    }
    //# sourceMappingURL=index.js.map

    const VERSION$3 = "1.2.4";

    // @ts-nocheck there is only place for one of us in this file. And it's not you, TS
    async function getAuthentication(state) {
        // handle code exchange form OAuth Web Flow
        if ("code" in state.strategyOptions) {
            const { authentication } = await distNode_7({
                clientId: state.clientId,
                clientSecret: state.clientSecret,
                clientType: state.clientType,
                ...state.strategyOptions,
                request: state.request,
            });
            return {
                type: "token",
                tokenType: "oauth",
                ...authentication,
            };
        }
        // handle OAuth device flow
        if ("onVerification" in state.strategyOptions) {
            const deviceAuth = createOAuthDeviceAuth({
                clientType: state.clientType,
                clientId: state.clientId,
                ...state.strategyOptions,
                request: state.request,
            });
            const authentication = await deviceAuth({
                type: "oauth",
            });
            return {
                clientSecret: state.clientSecret,
                ...authentication,
            };
        }
        // use existing authentication
        if ("token" in state.strategyOptions) {
            return {
                type: "token",
                tokenType: "oauth",
                clientId: state.clientId,
                clientSecret: state.clientSecret,
                clientType: state.clientType,
                ...state.strategyOptions,
            };
        }
        throw new Error("[@octokit/auth-oauth-user] Invalid strategy options");
    }

    async function auth$1(state, options = {}) {
        if (!state.authentication) {
            // This is what TS makes us do ¯\_(ツ)_/¯
            state.authentication =
                state.clientType === "oauth-app"
                    ? await getAuthentication(state)
                    : await getAuthentication(state);
        }
        if (state.authentication.invalid) {
            throw new Error("[@octokit/auth-oauth-user] Token is invalid");
        }
        const currentAuthentication = state.authentication;
        // (auto) refresh for user-to-server tokens
        if ("expiresAt" in currentAuthentication) {
            if (options.type === "refresh" ||
                new Date(currentAuthentication.expiresAt) < new Date()) {
                const { authentication } = await distNode_9({
                    clientType: "github-app",
                    clientId: state.clientId,
                    clientSecret: state.clientSecret,
                    refreshToken: currentAuthentication.refreshToken,
                    request: state.request,
                });
                state.authentication = {
                    tokenType: "oauth",
                    type: "token",
                    ...authentication,
                };
            }
        }
        // throw error for invalid refresh call
        if (options.type === "refresh") {
            if (state.clientType === "oauth-app") {
                throw new Error("[@octokit/auth-oauth-user] OAuth Apps do not support expiring tokens");
            }
            if (!currentAuthentication.hasOwnProperty("expiresAt")) {
                throw new Error("[@octokit/auth-oauth-user] Refresh token missing");
            }
        }
        // check or reset token
        if (options.type === "check" || options.type === "reset") {
            const method = options.type === "check" ? distNode_2 : distNode_10;
            try {
                const { authentication } = await method({
                    // @ts-expect-error making TS happy would require unnecessary code so no
                    clientType: state.clientType,
                    clientId: state.clientId,
                    clientSecret: state.clientSecret,
                    token: state.authentication.token,
                    request: state.request,
                });
                state.authentication = {
                    tokenType: "oauth",
                    type: "token",
                    // @ts-expect-error TBD
                    ...authentication,
                };
                return state.authentication;
            }
            catch (error) {
                // istanbul ignore else
                if (error.status === 404) {
                    error.message = "[@octokit/auth-oauth-user] Token is invalid";
                    // @ts-expect-error TBD
                    state.authentication.invalid = true;
                }
                throw error;
            }
        }
        // invalidate
        if (options.type === "delete" || options.type === "deleteAuthorization") {
            const method = options.type === "delete" ? distNode_5 : distNode_4;
            try {
                await method({
                    // @ts-expect-error making TS happy would require unnecessary code so no
                    clientType: state.clientType,
                    clientId: state.clientId,
                    clientSecret: state.clientSecret,
                    token: state.authentication.token,
                    request: state.request,
                });
            }
            catch (error) {
                // istanbul ignore if
                if (error.status !== 404)
                    throw error;
            }
            state.authentication.invalid = true;
            return state.authentication;
        }
        return state.authentication;
    }

    /**
     * The following endpoints require an OAuth App to authenticate using its client_id and client_secret.
     *
     * - [`POST /applications/{client_id}/token`](https://docs.github.com/en/rest/reference/apps#check-a-token) - Check a token
     * - [`PATCH /applications/{client_id}/token`](https://docs.github.com/en/rest/reference/apps#reset-a-token) - Reset a token
     * - [`POST /applications/{client_id}/token/scoped`](https://docs.github.com/en/rest/reference/apps#create-a-scoped-access-token) - Create a scoped access token
     * - [`DELETE /applications/{client_id}/token`](https://docs.github.com/en/rest/reference/apps#delete-an-app-token) - Delete an app token
     * - [`DELETE /applications/{client_id}/grant`](https://docs.github.com/en/rest/reference/apps#delete-an-app-authorization) - Delete an app authorization
     *
     * deprecated:
     *
     * - [`GET /applications/{client_id}/tokens/{access_token}`](https://docs.github.com/en/rest/reference/apps#check-an-authorization) - Check an authorization
     * - [`POST /applications/{client_id}/tokens/{access_token}`](https://docs.github.com/en/rest/reference/apps#reset-an-authorization) - Reset an authorization
     * - [`DELETE /applications/{client_id}/tokens/{access_token}`](https://docs.github.com/en/rest/reference/apps#revoke-an-authorization-for-an-application) - Revoke an authorization for an application
     * - [`DELETE /applications/{client_id}/grants/{access_token}`](https://docs.github.com/en/rest/reference/apps#revoke-a-grant-for-an-application) - Revoke a grant for an application
     */
    const ROUTES_REQUIRING_BASIC_AUTH = /\/applications\/[^/]+\/(token|grant)s?/;
    function requiresBasicAuth(url) {
        return url && ROUTES_REQUIRING_BASIC_AUTH.test(url);
    }

    async function hook$1(state, request, route, parameters = {}) {
        const endpoint = request.endpoint.merge(route, parameters);
        // Do not intercept OAuth Web/Device flow request
        if (/\/login\/(oauth\/access_token|device\/code)$/.test(endpoint.url)) {
            return request(endpoint);
        }
        if (requiresBasicAuth(endpoint.url)) {
            const credentials = btoaNode(`${state.clientId}:${state.clientSecret}`);
            endpoint.headers.authorization = `basic ${credentials}`;
            return request(endpoint);
        }
        // TS makes us do this ¯\_(ツ)_/¯
        const { token } = state.clientType === "oauth-app"
            ? await auth$1({ ...state, request })
            : await auth$1({ ...state, request });
        endpoint.headers.authorization = "token " + token;
        return request(endpoint);
    }

    function createOAuthUserAuth({ clientId, clientSecret, clientType = "oauth-app", request: request$1 = request.defaults({
        headers: {
            "user-agent": `octokit-auth-oauth-app.js/${VERSION$3} ${getUserAgent()}`,
        },
    }), ...strategyOptions }) {
        const state = Object.assign({
            clientType,
            clientId,
            clientSecret,
            strategyOptions,
            request: request$1,
        });
        // @ts-expect-error not worth the extra code needed to appease TS
        return Object.assign(auth$1.bind(null, state), {
            // @ts-expect-error not worth the extra code needed to appease TS
            hook: hook$1.bind(null, state),
        });
    }
    createOAuthUserAuth.VERSION = VERSION$3;
    //# sourceMappingURL=index.js.map

    async function auth$2(state, authOptions) {
        if (authOptions.type === "oauth-app") {
            return {
                type: "oauth-app",
                clientId: state.clientId,
                clientSecret: state.clientSecret,
                clientType: state.clientType,
                headers: {
                    authorization: `basic ${btoaNode(`${state.clientId}:${state.clientSecret}`)}`,
                },
            };
        }
        if ("factory" in authOptions) {
            const { type, ...options } = {
                ...authOptions,
                ...state,
            };
            // @ts-expect-error TODO: `option` cannot be never, is this a bug?
            return authOptions.factory(options);
        }
        const common = {
            clientId: state.clientId,
            clientSecret: state.clientSecret,
            request: state.request,
            ...authOptions,
        };
        // TS: Look what you made me do
        const userAuth = state.clientType === "oauth-app"
            ? await createOAuthUserAuth({
                ...common,
                clientType: state.clientType,
            })
            : await createOAuthUserAuth({
                ...common,
                clientType: state.clientType,
            });
        return userAuth();
    }

    async function hook$2(state, request, route, parameters) {
        let endpoint = request.endpoint.merge(route, parameters);
        // Do not intercept OAuth Web/Device flow request
        if (/\/login\/(oauth\/access_token|device\/code)$/.test(endpoint.url)) {
            return request(endpoint);
        }
        if (!requiresBasicAuth(endpoint.url)) {
            throw new Error(`[@octokit/auth-oauth-app] "${endpoint.method} ${endpoint.url}" does not support clientId/clientSecret basic authentication. Use @octokit/auth-oauth-user instead.`);
        }
        const credentials = btoaNode(`${state.clientId}:${state.clientSecret}`);
        endpoint.headers.authorization = `basic ${credentials}`;
        return await request(endpoint);
    }

    const VERSION$4 = "4.1.2";

    function createOAuthAppAuth(options) {
        const state = Object.assign({
            request: request.defaults({
                headers: {
                    "user-agent": `octokit-auth-oauth-app.js/${VERSION$4} ${getUserAgent()}`,
                },
            }),
            clientType: "oauth-app",
        }, options);
        // @ts-expect-error not worth the extra code to appease TS
        return Object.assign(auth$2.bind(null, state), {
            // @ts-expect-error not worth the extra code to appease TS
            hook: hook$2.bind(null, state),
        });
    }
    //# sourceMappingURL=index.js.map

    /* components/JsonGenerator.svelte generated by Svelte v3.37.0 */

    const { console: console_1 } = globals;
    const file = "components/JsonGenerator.svelte";

    function create_fragment(ctx) {
    	let main;
    	let header;
    	let h1;
    	let t1;
    	let div0;
    	let button0;
    	let t3;
    	let button1;
    	let t5;
    	let div3;
    	let div1;
    	let textarea;
    	let t6;
    	let div2;
    	let pre;
    	let t7;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			header = element("header");
    			h1 = element("h1");
    			h1.textContent = "JSON Generator";
    			t1 = space();
    			div0 = element("div");
    			button0 = element("button");
    			button0.textContent = " Save ";
    			t3 = space();
    			button1 = element("button");
    			button1.textContent = "Reload";
    			t5 = space();
    			div3 = element("div");
    			div1 = element("div");
    			textarea = element("textarea");
    			t6 = space();
    			div2 = element("div");
    			pre = element("pre");
    			t7 = text(/*jsonOutput*/ ctx[1]);
    			attr_dev(h1, "class", "header-title svelte-11ebzd6");
    			add_location(h1, file, 35, 8, 1259);
    			attr_dev(header, "class", "header svelte-11ebzd6");
    			add_location(header, file, 34, 4, 1227);
    			add_location(button0, file, 38, 8, 1351);
    			add_location(button1, file, 39, 8, 1418);
    			attr_dev(div0, "class", "button svelte-11ebzd6");
    			add_location(div0, file, 37, 4, 1322);
    			attr_dev(textarea, "class", "source svelte-11ebzd6");
    			add_location(textarea, file, 43, 12, 1528);
    			attr_dev(div1, "class", "left-panel svelte-11ebzd6");
    			add_location(div1, file, 42, 8, 1491);
    			attr_dev(pre, "class", "output svelte-11ebzd6");
    			add_location(pre, file, 46, 12, 1644);
    			attr_dev(div2, "class", "right-panel svelte-11ebzd6");
    			add_location(div2, file, 45, 8, 1606);
    			attr_dev(div3, "class", "html-editor svelte-11ebzd6");
    			add_location(div3, file, 41, 4, 1457);
    			attr_dev(main, "class", "container svelte-11ebzd6");
    			add_location(main, file, 33, 0, 1198);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, header);
    			append_dev(header, h1);
    			append_dev(main, t1);
    			append_dev(main, div0);
    			append_dev(div0, button0);
    			append_dev(div0, t3);
    			append_dev(div0, button1);
    			append_dev(main, t5);
    			append_dev(main, div3);
    			append_dev(div3, div1);
    			append_dev(div1, textarea);
    			set_input_value(textarea, /*inputTemplate*/ ctx[0]);
    			append_dev(div3, t6);
    			append_dev(div3, div2);
    			append_dev(div2, pre);
    			append_dev(pre, t7);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*generateToken*/ ctx[2], false, false, false),
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[4])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*inputTemplate*/ 1) {
    				set_input_value(textarea, /*inputTemplate*/ ctx[0]);
    			}

    			if (dirty & /*jsonOutput*/ 2) set_data_dev(t7, /*jsonOutput*/ ctx[1]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    const gitURL = "https://raw.githubusercontent.com/rahgadda/generate-json/main/";

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("JsonGenerator", slots, []);
    	let { urlCode } = $$props;
    	let inputTemplate = "";
    	let jsonOutput = "";

    	onMount(async function () {
    		let response = await fetch(gitURL + "data/sample.hbs");
    		$$invalidate(0, inputTemplate = await response.text());
    		response = await fetch(gitURL + "response/sample.json");
    		$$invalidate(1, jsonOutput = await response.text());
    	});

    	async function generateToken() {
    		const auth = createOAuthAppAuth({
    			clientType: "oauth-app",
    			clientId: "32748c79e2f3936ca0cb",
    			clientSecret: "c871dbe5c837905a541c03d33fb44858c5973a8b"
    		});

    		const userAuthenticationFromWebFlow = await auth({ type: "oauth-user", code: urlCode });
    		console.log("Token is" + userAuthenticationFromWebFlow.token);
    	}

    	const writable_props = ["urlCode"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<JsonGenerator> was created with unknown prop '${key}'`);
    	});

    	function textarea_input_handler() {
    		inputTemplate = this.value;
    		$$invalidate(0, inputTemplate);
    	}

    	$$self.$$set = $$props => {
    		if ("urlCode" in $$props) $$invalidate(3, urlCode = $$props.urlCode);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		createOAuthAppAuth,
    		urlCode,
    		gitURL,
    		inputTemplate,
    		jsonOutput,
    		generateToken
    	});

    	$$self.$inject_state = $$props => {
    		if ("urlCode" in $$props) $$invalidate(3, urlCode = $$props.urlCode);
    		if ("inputTemplate" in $$props) $$invalidate(0, inputTemplate = $$props.inputTemplate);
    		if ("jsonOutput" in $$props) $$invalidate(1, jsonOutput = $$props.jsonOutput);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [inputTemplate, jsonOutput, generateToken, urlCode, textarea_input_handler];
    }

    class JsonGenerator extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { urlCode: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "JsonGenerator",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*urlCode*/ ctx[3] === undefined && !("urlCode" in props)) {
    			console_1.warn("<JsonGenerator> was created without expected prop 'urlCode'");
    		}
    	}

    	get urlCode() {
    		throw new Error("<JsonGenerator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set urlCode(value) {
    		throw new Error("<JsonGenerator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* components/Login.svelte generated by Svelte v3.37.0 */

    const file$1 = "components/Login.svelte";

    function create_fragment$1(ctx) {
    	let link;
    	let t0;
    	let a;

    	const block = {
    		c: function create() {
    			link = element("link");
    			t0 = space();
    			a = element("a");
    			a.textContent = "  Login";
    			attr_dev(link, "rel", "stylesheet");
    			attr_dev(link, "href", "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css");
    			add_location(link, file$1, 0, 0, 0);
    			attr_dev(a, "href", "https://github.com/login/oauth/authorize?client_id=32748c79e2f3936ca0cb&scope=user:email");
    			attr_dev(a, "aria-label", "Login with Github");
    			attr_dev(a, "class", "centered fa fa-github svelte-1o3tlka");
    			add_location(a, file$1, 4, 0, 124);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, link, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, a, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(link);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Login", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Login> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Login extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Login",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* components/App.svelte generated by Svelte v3.37.0 */

    function create_fragment$2(ctx) {
    	let jsongenerator;
    	let current;

    	jsongenerator = new JsonGenerator({
    			props: { urlCode: /*urlCode*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(jsongenerator.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(jsongenerator, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(jsongenerator.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(jsongenerator.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(jsongenerator, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	const parmas = new URLSearchParams(window.location.search);
    	const urlCode = parmas.get("code");
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ JsonGenerator, Login, parmas, urlCode });
    	return [urlCode];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    const app = new App({
      target: document.body
    });

    return app;

}(Stream, http, Url, https, zlib));
//# sourceMappingURL=bundle.js.map
