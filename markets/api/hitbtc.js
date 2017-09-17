var https = require("https");
var querystring = require("querystring");
var crypto = require("crypto");
var _ = require("underscore");

function HitBTCClient (APIKey, APISecret, APIType) {
    this.APIKey = APIKey;
    this.APISecret = APISecret;
    this.APIType = APIType || "sandbox";
    this.APIVersion = "1";
};

HitBTCClient.HOSTS = {
    live: "api.hitbtc.com",
    sandbox: "demo-api.hitbtc.com"
};

HitBTCClient.prototype._get = function (endpoint, destination, params, callback) {
    var options = {
        host: HitBTCClient.HOSTS[this.APIType],
        path: "/api/" + this.APIVersion + "/" + destination + "/" + endpoint,
        method: "get",
        headers: {
            "User-Agent": "Mozilla/4.0 (compatible; HitBTC node.js client)"
        }
    };

    if (destination !== "public") {
        this._authorize("get", options, params);
    }
    else if (Object.keys(params).length) {
        options.path = options.path + "?" + querystring.stringify(params);
    }

    var req = https.request(options, function (res) {
        res.setEncoding("utf8");
        var buffer = "";
        res.on("data", function (data) {
            buffer += data;
        });
        res.on("end", function () {
            try {
                var json = JSON.parse(buffer);
            } catch (err) {
                return callback(err);
            }
            callback(null, json);
        });
    });

    req.on("error", function (err) {
        callback(err);
    });

    req.on("socket", function (socket) {
        socket.setTimeout(5000);
        socket.on("timeout", function() {
          req.abort();
        });
    });

    req.end();
};

HitBTCClient.prototype._post = function (endpoint, destination, params, callback) {
    var options = {
        host: HitBTCClient.HOSTS[this.APIType],
        path: "/api/" + this.APIVersion + "/" + destination + "/" + endpoint,
        method: "post",
        headers: {
            "User-Agent": "Mozilla/4.0 (compatible; HitBTC node.js client)",
        }
    };

    this._authorize("post", options, params);

    var req = https.request(options, function (res) {
        res.setEncoding("utf8");
        var buffer = "";
        res.on("data", function (data) {
            buffer += data;
        });
        res.on("end", function () {
            try {
                var json = JSON.parse(buffer);
            } catch (err) {
                return callback(err);
            }
            callback(null, json);
        });
    });

    req.on("error", function (err) {
        callback(err);
    });

    req.on("socket", function (socket) {
        socket.setTimeout(5000);
        socket.on("timeout", function() {
          req.abort();
        });
    });
    
    req.end(querystring.stringify(params));
};

HitBTCClient.prototype._authorize = function (requestType, options, params) {
    var authParams = { 
        nonce: Date.now(),
        apikey: this.APIKey
    };

    var message;

    if (requestType === "get") {
        options.path = options.path + "?" + querystring.stringify(_.extend({}, authParams, params));

        message = options.path;
    }
    else {
        options.path = options.path + "?" + querystring.stringify(authParams);

        message = options.path + querystring.stringify(params);
    }

    options.headers["X-Signature"] = crypto.createHmac("sha512", this.APISecret).update(message).digest("hex");
};

/*
 * Public API Methods
 */

HitBTCClient.prototype.time = function (callback) {
    this._get("time", "public", {}, callback);
};

HitBTCClient.prototype.pairs = function (callback) {
    this._get("pairs", "public", {}, callback);
};

HitBTCClient.prototype.ticker = function (pair, callback) {
    this._get(pair + "/ticker", "public", {}, callback);
};

HitBTCClient.prototype.orderbook = function (pair, callback) {
    this._get(pair + "/orderbook?format_price=number&format_amount=number", "public", {}, callback);
};

HitBTCClient.prototype.trades = function () {
    throw new Error("Not Implemented");
};

/*
 * Trading API Methods
 */

HitBTCClient.prototype.tradingBalance = function (callback) {
    this._get("balance", "trading", {}, callback);
};

HitBTCClient.prototype.activeOrders = function (pairs, callback) {
    this._get("orders/active", "trading", { symbols: pairs }, callback);
};

HitBTCClient.prototype.newOrder = function (clientOrderId, pair, side, price, quantity, type, timeInForce, callback) {
    var obj = { clientOrderId: clientOrderId, symbol: pair, side: side, quantity: quantity, type: type, timeInForce: timeInForce };

    if (type !== "market") {
        obj["price"] = price;
    }

    this._post("new_order", "trading", obj, callback);
};

HitBTCClient.prototype.cancelOrder = function (clientOrderId, cancelRequestClientOrderId, pair, side, callback) {
    throw new Error("Not Implemented");
};

HitBTCClient.prototype.trades = function (by, start_index, max_results, symbols, sort, from, till, callback) {
    throw new Error("Not Implemented");
};

HitBTCClient.prototype.recentOrders = function  (start_index, max_results, symbols, statuses, callback) {
    throw new Error("Not Implemented");
};

/*
 * Payment API Methods
 */

HitBTCClient.prototype.paymentBalance = function (callback) {
    this._get("balance", "payment", {}, callback);
};

HitBTCClient.prototype.transferToTrading = function (amount, currency_code, callback) {
    throw new Error("Not Implemented");
};

HitBTCClient.prototype.transferToMain = function (amount, currency_code, callback) {
    throw new Error("Not Implemented");
};

HitBTCClient.prototype.getPaymentAddress = function (currency_code, callback) {
    this._get("address/" + currency_code, "payment", {}, callback);
};

HitBTCClient.prototype.createPaymentAddress = function (currency_code, callback) {
    throw new Error("Not Implemented");
};

HitBTCClient.prototype.payout = function (amount, currency_code, address) {
    throw new Error("Not Implemented");
};

HitBTCClient.prototype.transactions = function (offset, limit, dir) {
    throw new Error("Not Implemented");
};

module.exports = HitBTCClient;
