var Telnet = require('telnet-client')
var events = require('events')
const logging = require('homeautomation-js-lib/logging.js')

module.exports = function(config) {
	this.lutronLoc = config.ip
	var node = this
	this.deviceMap = config.deviceMap

	node.connected = false
	node.telnet = new Telnet()
	node.port = 23
	node.devices = {}
	node.lutronEvent = new events.EventEmitter()

	var params = {
		host: this.lutronLoc,
		port: this.port,
		shellPrompt: 'GNET>',
		debug: true,
		username: 'lutron',
		password: 'integration',
		timeout: 5000
	}

	this.connect = function() {
		this.telnet.connect(params)
	}

	this.deferredConnect = function() {
		setTimeout(function() {
			this.connect()
		}, 10)
	}

	this._sendCommandFunction = function(func) {
		if (!this.connected) {
			this.connect()
			setTimeout(func, 5)
		} else {
			func()
		}

	}
	this.sendLutronCommand = function(devId, val) {
		logging.info('sendLutronCommand: ' + devId + ' =' + val)
		var str = '#OUTPUT,' + devId + ',1,' + val
		this.lutronSend(str)
	}

	this.sendLutronStatus = function(devId) {
		logging.info('sendLutronCommand: ' + devId + ' =' + val)
		var str = '?OUTPUT,' + devId + ',1'
		this.lutronSend(str)
	}

	this.telnet.on('data', (function(self, pkt) {
		self.lutronRecv(pkt)
	}).bind(null, node))

	this.telnet.on('connect', function() {
		this.connected = true
		logging.info('telnet connect')
	})

	this.telnet.on('close', function() {
		this.connected = false
		logging.error('telnet closed')
		this.deferredConnect()
	})

	this.telnet.on('error', function() {
		logging.error('telnet error, disconnected')
		this.connected = false
		this.deferredConnect()

	})

	this.telnet.on('failedlogin', function() {
		logging.error('telnet failed login')
		this.connected = false
	})

	this.lutronSend = function(msg, fn) {
		this._sendCommandFunction(function() {
			this.telnet.getSocket().write(msg + '\n', fn)
		})
	}

	this.lutronUpdate = function(deviceId, fn) {
		this.lutronSend('?OUTPUT,' + deviceId + ',1', fn)
	}

	this.lutronSend = function(deviceId, val, fn) {
		this.lutronSend('#OUTPUT,' + deviceId + ',1,' + val, fn)
	}

	this.lutronRecv = function(data) {
		var st = data.toString().trim()
		logging.info('Lutron data Received:' + st)
		var cmd = st[0]
		var cs = st.substring(1).split(',')
		var type = cs[0]

		if (cs.length > 3) {
			var deviceId = parseInt(cs[1])
			var action = parseInt(cs[2])
			var param = parseFloat(cs[3])

			this.lutronEvent.emit('data', {
				cmd: cmd,
				type: type,
				deviceId: deviceId,
				action: action,
				param: param
			})
		}
	}

	this.connect()
}
