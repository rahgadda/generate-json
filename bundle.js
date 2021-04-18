var app = (function () {
    'use strict';

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
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
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
    function empty() {
        return text('');
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
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
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

    class Fetch{
        
        // Make an HTTP GET Request 
        async get(url) {
      
            // Awaiting for fetch response
            const response = await fetch(url);
      
            // Awaiting for response.json()
            const resData = await response.json();
      
            // Returning result data
            return resData;
        }
      
        // Make an HTTP GET Request with Token as input
        async getWithToken(url,token) {
      
            // Awaiting for fetch response
            const response = await fetch(url,{
                "method": "GET",
                "headers": {
                    "Authorization": "token "+token,
                    "Accept": "application/vnd.github.v3+json"
                }
            });
      
            // Awaiting for response.json()
            const data = await response.json();

            // Awaiting for data.sha
            const resData = await data.sha;
      
            // Returning result data
            return resData;
        }

        // Make an HTTP POST Request
        async post(url, data) {
      
            // Awaiting for fetch response and 
            // defining method, headers and body  
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-type': 'application/json',
                    "Accept":"application/json",
                    "origin": "x-requested-with"
                },
                body: JSON.stringify(data)
            });
      
            // Awaiting response.json()
            const resData = await response.json();
      
            // Returning result data
            return resData;
        }

        // Make an HTTP POST Request with No Data
        async postNoData(url) {
      
            // Awaiting for fetch response and 
            // defining method, headers and body  
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-type': 'application/json',
                    "Accept":"application/json",
                    "origin": "x-requested-with"
                }
            });
      
            // Awaiting response.json()
            const resData = await response.json();
            console.log("Result Data"+JSON.stringify(resData));
            
            // Returning result data
            return resData;
        }

        // Make an HTTP POST Request
        async putWithToken(url,token, data) {
      
            // Awaiting for fetch response and 
            // defining method, headers and body  
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-type': 'application/json',
                    "Accept":"application/json",
                    "Authorization": "token "+token,
                },
                body: JSON.stringify(data)
            });
      
            // Awaiting response.json()
            const resData = await response.json();
      
            // Returning result data
            return resData;
        }
    }

    const http = new Fetch;
    const gitAPIURL = "https://cors-anywhere.herokuapp.com/https://github.com/login/oauth/access_token?client_id=32748c79e2f3936ca0cb&client_secret=c871dbe5c837905a541c03d33fb44858c5973a8b&code=";

    class GitGenerateToken{
        getToken(code){
            return (async () => await http.postNoData(gitAPIURL+code) )();
        }
    }

    const http$1 = new Fetch;
    const gitAPIURL$1 = "https://api.github.com/repos/rahgadda/generate-json/contents/data/sample.hbs";

    class GitGenerateSHAToken {
        getSHAToken(token){
            console.log("Access Token in SHA "+token);
            return (async () => await http$1.getWithToken(gitAPIURL$1,token) )();
        }
    }

    const http$2 = new Fetch;
    const gitAPIURL$2 = "https://api.github.com/repos/rahgadda/generate-json/contents/data/sample.hbs";

    class GitUploadFile {
        uploadTemplate(token,data){
            return (async () => await http$2.putWithToken(gitAPIURL$2,token,data) )();
        }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const access_token = writable(localStorage.getItem("access_token") || "");

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
    			add_location(h1, file, 68, 8, 2293);
    			attr_dev(header, "class", "header svelte-11ebzd6");
    			add_location(header, file, 67, 4, 2261);
    			add_location(button0, file, 71, 8, 2385);
    			add_location(button1, file, 72, 8, 2447);
    			attr_dev(div0, "class", "button svelte-11ebzd6");
    			add_location(div0, file, 70, 4, 2356);
    			attr_dev(textarea, "class", "source svelte-11ebzd6");
    			add_location(textarea, file, 76, 12, 2580);
    			attr_dev(div1, "class", "left-panel svelte-11ebzd6");
    			add_location(div1, file, 75, 8, 2543);
    			attr_dev(pre, "class", "output svelte-11ebzd6");
    			add_location(pre, file, 79, 12, 2696);
    			attr_dev(div2, "class", "right-panel svelte-11ebzd6");
    			add_location(div2, file, 78, 8, 2658);
    			attr_dev(div3, "class", "html-editor svelte-11ebzd6");
    			add_location(div3, file, 74, 4, 2509);
    			attr_dev(main, "class", "container svelte-11ebzd6");
    			add_location(main, file, 66, 0, 2232);
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
    					listen_dev(button0, "click", /*saveFile*/ ctx[2], false, false, false),
    					listen_dev(button1, "click", /*refreshJson*/ ctx[3], false, false, false),
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[5])
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
    	let $access_token;
    	validate_store(access_token, "access_token");
    	component_subscribe($$self, access_token, $$value => $$invalidate(8, $access_token = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("JsonGenerator", slots, []);
    	let { urlCode } = $$props;
    	let inputTemplate = "";
    	let jsonOutput = "";
    	let accessToken = "";
    	let shaToken = "";

    	onMount(async function () {
    		let response = await fetch(gitURL + "data/sample.hbs", { "method": "GET" });
    		$$invalidate(0, inputTemplate = await response.text());
    		response = await fetch(gitURL + "response/sample.json", { "method": "GET" });
    		$$invalidate(1, jsonOutput = await response.text());
    		accessToken = $access_token;
    	});

    	async function saveFile() {
    		console.log("Saving File ");
    		let response;

    		if (!accessToken) {
    			console.log("Generating Access Token");
    			response = await new GitGenerateToken().getToken(urlCode);
    			accessToken = await response.access_token;
    			access_token.set(accessToken);
    		}

    		console.log("Generating SHA Token");
    		response = await new GitGenerateSHAToken().getSHAToken(accessToken);
    		shaToken = await response;

    		let data = {
    			name: "sample.hbs",
    			path: "data/sample.hbs",
    			sha: shaToken,
    			content: btoa(inputTemplate),
    			encoding: "base64",
    			message: "Updated From UI"
    		};

    		console.log("Updating File");
    		response = await new GitUploadFile().uploadTemplate(accessToken, data);
    	}

    	async function refreshJson() {
    		console.log("Refersh JSON " + urlCode);
    		let response = await fetch(gitURL + "data/sample.hbs", { "method": "GET" });
    		$$invalidate(0, inputTemplate = await response.text());
    		response = await fetch(gitURL + "response/sample.json", { "method": "GET" });
    		$$invalidate(1, jsonOutput = await response.text());
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
    		if ("urlCode" in $$props) $$invalidate(4, urlCode = $$props.urlCode);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		GitGenerateToken,
    		GitGenerateSHAToken,
    		GitUploadFile,
    		access_token,
    		urlCode,
    		gitURL,
    		inputTemplate,
    		jsonOutput,
    		accessToken,
    		shaToken,
    		saveFile,
    		refreshJson,
    		$access_token
    	});

    	$$self.$inject_state = $$props => {
    		if ("urlCode" in $$props) $$invalidate(4, urlCode = $$props.urlCode);
    		if ("inputTemplate" in $$props) $$invalidate(0, inputTemplate = $$props.inputTemplate);
    		if ("jsonOutput" in $$props) $$invalidate(1, jsonOutput = $$props.jsonOutput);
    		if ("accessToken" in $$props) accessToken = $$props.accessToken;
    		if ("shaToken" in $$props) shaToken = $$props.shaToken;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		inputTemplate,
    		jsonOutput,
    		saveFile,
    		refreshJson,
    		urlCode,
    		textarea_input_handler
    	];
    }

    class JsonGenerator extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { urlCode: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "JsonGenerator",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*urlCode*/ ctx[4] === undefined && !("urlCode" in props)) {
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
    			attr_dev(a, "href", "https://github.com/login/oauth/authorize?client_id=32748c79e2f3936ca0cb&scope=repo");
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

    // (16:0) {:else}
    function create_else_block(ctx) {
    	let login;
    	let current;
    	login = new Login({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(login.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(login, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(login.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(login.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(login, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(16:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (14:0) {#if $access_token || urlCode}
    function create_if_block(ctx) {
    	let jsongenerator;
    	let current;

    	jsongenerator = new JsonGenerator({
    			props: { urlCode: /*urlCode*/ ctx[1] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(jsongenerator.$$.fragment);
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
    		id: create_if_block.name,
    		type: "if",
    		source: "(14:0) {#if $access_token || urlCode}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*$access_token*/ ctx[0] || /*urlCode*/ ctx[1]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
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
    	let $access_token;
    	validate_store(access_token, "access_token");
    	component_subscribe($$self, access_token, $$value => $$invalidate(0, $access_token = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);

    	access_token.subscribe(value => {
    		localStorage.setItem("access_token", value);
    	});

    	const parmas = new URLSearchParams(window.location.search);
    	const urlCode = parmas.get("code");
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		JsonGenerator,
    		Login,
    		access_token,
    		parmas,
    		urlCode,
    		$access_token
    	});

    	return [$access_token, urlCode];
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

}());
//# sourceMappingURL=bundle.js.map
