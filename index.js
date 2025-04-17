const express = require('express');
const webpush = require('web-push');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(cors()); // Enable CORS for all routes

// VAPID keys should be generated only once and stored securely
// In production, these should come from environment variables
const vapidKeys = webpush.generateVAPIDKeys();

// Set VAPID details
webpush.setVapidDetails(
	'mailto:example@example.com',
	vapidKeys.publicKey,
	vapidKeys.privateKey
);

// Store subscriptions (in a real app, you would use a database)
const subscriptions = [];

// API Endpoints
// Get VAPID public key
app.get('/api/vapid-public-key', (req, res) => {
	res.json({ publicKey: vapidKeys.publicKey });
});

// Subscribe endpoint
app.post('/api/subscribe', (req, res) => {
	const subscription = req.body;

	// Validate subscription object
	if (!subscription || !subscription.endpoint) {
		return res.status(400).json({
			success: false,
			message: 'Subscription object is missing or invalid'
		});
	}

	// Store the subscription
	// In a real app, check if it already exists first
	console.log('New subscription received:', JSON.stringify(subscription));
	subscriptions.push(subscription);

	res.status(201).json({
		success: true,
		message: 'Subscription added successfully'
	});
});

// Send notification to all subscribers
app.post('/api/send-notification', (req, res) => {
	const { title, body, icon, tag, data, actions, url } = req.body;

	// Ensure there are subscriptions to send to
	if (subscriptions.length === 0) {
		return res.status(404).json({
			success: false,
			message: 'No subscriptions found'
		});
	}

	// Build notification payload
	const notificationPayload = {
		notification: {
			title: title || 'New Notification',
			body: body || 'This is a push notification!',
			icon: icon || 'https://via.placeholder.com/128',
			vibrate: [100, 50, 100],
			tag: tag || 'default',
			data: data || {
				dateOfArrival: Date.now(),
				url: url || ''
			}
		}
	};

	// Add actions if provided
	if (actions && Array.isArray(actions)) {
		notificationPayload.notification.actions = actions;
	}

	console.log('Sending notification:', JSON.stringify(notificationPayload));
	console.log('To subscribers count:', subscriptions.length);

	// Send notifications to all subscriptions
	const sendNotificationPromises = subscriptions.map((subscription) => {
		return webpush
			.sendNotification(subscription, JSON.stringify(notificationPayload))
			.catch((err) => {
				if (err.statusCode === 404 || err.statusCode === 410) {
					console.log(
						'Subscription has expired or is no longer valid:',
						subscription.endpoint
					);
					// In a real app, you would remove the subscription from your database
					return null;
				} else {
					throw err;
				}
			});
	});

	Promise.all(sendNotificationPromises)
		.then((results) => {
			// Filter out null results (failed subscriptions)
			const successCount = results.filter((result) => result !== null).length;
			res.status(200).json({
				success: true,
				message: `Notifications sent successfully to ${successCount} subscribers`
			});
		})
		.catch((err) => {
			console.error('Error sending notifications:', err);
			res.status(500).json({
				success: false,
				error: 'Failed to send notifications',
				message: err.message
			});
		});
});

// Send notification to a single subscriber by endpoint (useful for targeting specific users)
app.post('/api/send-notification/:endpoint', (req, res) => {
	const endpoint = decodeURIComponent(req.params.endpoint);
	const { title, body, icon, tag, data, actions, url } = req.body;

	// Find the subscription with the given endpoint
	const subscription = subscriptions.find((sub) => sub.endpoint === endpoint);

	if (!subscription) {
		return res.status(404).json({
			success: false,
			message: 'Subscription not found for the given endpoint'
		});
	}

	// Build notification payload
	const notificationPayload = {
		notification: {
			title: title || 'New Notification',
			body: body || 'This is a push notification!',
			icon: icon || 'https://via.placeholder.com/128',
			vibrate: [100, 50, 100],
			tag: tag || 'default',
			data: data || {
				dateOfArrival: Date.now(),
				url: url || ''
			}
		}
	};

	// Add actions if provided
	if (actions && Array.isArray(actions)) {
		notificationPayload.notification.actions = actions;
	}

	// Send notification
	webpush
		.sendNotification(subscription, JSON.stringify(notificationPayload))
		.then(() => {
			res.status(200).json({
				success: true,
				message: 'Notification sent successfully'
			});
		})
		.catch((err) => {
			console.error('Error sending notification:', err);

			if (err.statusCode === 404 || err.statusCode === 410) {
				// Subscription is no longer valid
				res.status(410).json({
					success: false,
					message: 'Subscription has expired or is no longer valid'
				});
			} else {
				res.status(500).json({
					success: false,
					error: 'Failed to send notification',
					message: err.message
				});
			}
		});
});

// List all active subscriptions (for debugging purposes)
app.get('/api/subscriptions', (req, res) => {
	res.json({
		count: subscriptions.length,
		subscriptions: subscriptions.map((sub) => ({
			endpoint: sub.endpoint,
			// Don't expose the full keys in a real application
			keys: {
				p256dh: sub.keys.p256dh.substring(0, 10) + '...',
				auth: sub.keys.auth.substring(0, 5) + '...'
			}
		}))
	});
});

// For backwards compatibility, maintain the original endpoints
app.get('/vapid-public-key', (req, res) => {
	res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/subscribe', (req, res) => {
	const subscription = req.body;
	subscriptions.push(subscription);
	res.status(201).json({
		message: 'Subscription added successfully',
		publicKey: vapidKeys.publicKey
	});
});

app.post('/send-notification', (req, res) => {
	// Redirect to the new API endpoint
	const { title, body } = req.body;

	const notificationPayload = {
		title: title || 'New Notification',
		body: body || 'This is a push notification!',
		icon: 'https://via.placeholder.com/128',
		vibrate: [100, 50, 100],
		data: {
			dateOfArrival: Date.now(),
			primaryKey: 1
		},
		actions: [
			{
				action: 'explore',
				title: 'View Details'
			}
		]
	};

	const sendNotificationPromises = subscriptions.map((subscription) => {
		return webpush.sendNotification(
			subscription,
			JSON.stringify(notificationPayload)
		);
	});

	Promise.all(sendNotificationPromises)
		.then(() => {
			res.status(200).json({ message: 'Notifications sent successfully!' });
		})
		.catch((err) => {
			console.error('Error sending notifications:', err);
			res.status(500).json({ error: 'Failed to send notifications' });
		});
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server started on port ${PORT}`);
	console.log('VAPID Public Key:', vapidKeys.publicKey);
	console.log('VAPID Private Key:', vapidKeys.privateKey);
	console.log(
		'Save these keys for future use or use environmental variables to store them'
	);
});
