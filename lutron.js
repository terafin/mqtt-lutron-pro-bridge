var Telnet = require('telnet-client')
var events = require('events')
const logging = require('homeautomation-js-lib/logging.js')

var config = null
var connected = false
var telnetClient = new Telnet()
var emitter = new events.EventEmitter()


const deferredConnect = function() {
	logging.info('Deferring connectect')
	setTimeout(function() {
		connect()
	}, 10)
}

const _sendCommandFunction = function(func) {
	if (!connected) {
		connect()
		setTimeout(func, 5)
	} else {
		func()
	}

}

telnetClient.on('data', (function(pkt) {
	lutronRecv(pkt)
}))

telnetClient.on('connect', function() {
	connected = true
	logging.info('Telnet connected')
})

telnetClient.on('close', function() {
	connected = false
	logging.error('Telnet closed')
	deferredConnect()
})

telnetClient.on('error', function() {
	logging.error('Telnet error, disconnected')
	connected = false
	deferredConnect()
})

telnetClient.on('failedlogin', function() {
	logging.error('Telnet failed login')
	connected = false
})

const _lutronSend = function(msg, fn) {
	_sendCommandFunction(function() {
		logging.info('Sending command: ' + msg)
		telnetClient.getSocket().write(msg + '\n', fn)
	})
}

const lutronRecv = function(data) {
	var st = data.toString().trim()
	logging.info('Lutron data Received:' + st)
	var cmd = st[0]
	var cs = st.substring(1).split(',')
	var type = cs[0]

	if (cs.length > 3) {
		var deviceId = parseInt(cs[1])
		var action = parseInt(cs[2])
		var param = parseFloat(cs[3])

		emitter.emit('data', {
			cmd: cmd,
			type: type,
			deviceId: deviceId,
			action: action,
			param: param
		})
	}
}

const connect = function() {
	if (connected) {
		return
	}

	logging.info('Telnet connecting to: ' + config.ip)

	var params = {
		host: config.ip,
		port: 23,
		shellPrompt: 'GNET>',
		debug: true,
		username: 'lutron',
		password: 'integration',
		timeout: 5000
	}

	telnetClient.connect(params)
}


module.exports = function(inConfig) {
	config = inConfig

	connected = false
	this.lutronEvent = emitter

	this.sendLutronCommand = function(devId, val) {
		logging.info('sendLutronCommand: ' + devId + ' = ' + val)
		_lutronSend('#OUTPUT,' + devId + ',1,' + val)
	}

	this.sendButtonCommand = function(devId, val) {
		logging.info('sendButtonCommand: ' + devId + ' = ' + val)
		_lutronSend('#DEVICE,' + devId + ',' + val + ',4')
	}

	connect()
}
