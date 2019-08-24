// Requirements
const mqtt = require('mqtt')
const _ = require('lodash')

const logging = require('homeautomation-js-lib/logging.js')
const health = require('homeautomation-js-lib/health.js')
const mqtt_helpers = require('homeautomation-js-lib/mqtt_helpers.js')
const lutronLib = require('./lutron.js')

// Config
const lutronIP = process.env.LUTRON_IP
const host = process.env.MQTT_HOST
var topic_prefix = process.env.TOPIC_PREFIX

// Check basics
if (_.isNil(lutronIP)) {
	logging.warn('empty LUTRON_IP, not starting')
	process.abort()
}

if (_.isNil(host)) {
	logging.warn('empty MQTT_HOST, not starting')
	process.abort()
}

if (_.isNil(topic_prefix)) {
	logging.warn('empty TOPIC_PREFIX, using /isy')
	topic_prefix = '/lutron/'
}

// Setup Lutron
const lutron = new lutronLib({ip: lutronIP})


// MQTT Event Handlers
var connectedEvent = function() {
	var topic = topic_prefix + '/+/set'
	logging.info('Subscribing to topic: ' + topic)
	client.subscribe(topic, {qos: 1})

	topic = topic_prefix + '/+/press'
	logging.info('Subscribing to topic: ' + topic)
	client.subscribe(topic, {qos: 1})
	health.healthyEvent()
}

var disconnectedEvent = function() {
	logging.error('Reconnecting...')
	health.unhealthyEvent()
}

// Setup MQTT
var client = mqtt_helpers.setupClient(connectedEvent, disconnectedEvent)

if (_.isNil(client)) {
	logging.warn('MQTT Client Failed to Startup')
	process.abort()
}

// MQTT Observation
client.on('message', (topic, message) => {
	var components = topic.split('/')

	const deviceId = components[components.length - 2]
	logging.info(' => topic: ' + topic + '  message: ' + message + ' deviceId: ' + deviceId)
	if (deviceId != 0) {
		if (topic.includes('press')) {
			lutron.sendButtonCommand(deviceId, message)
		} else {
			lutron.sendLutronCommand(deviceId, message)
		}
	}
})

// Lutron observation
lutron.lutronEvent.on('data', (data) => {
	const topic = mqtt_helpers.generateTopic(topic_prefix, data.deviceId.toString(), data.action.toString())
	const message = data.param.toString()
	const type = data.type
	var options = {retain: (type == 'OUTPUT' ? true : false), qos: 1}

	logging.info(' => publishing topic: ' + topic + '    message: ' + message + '    options: ' + JSON.stringify(options))
	client.smartPublish(topic, message, options)
})
