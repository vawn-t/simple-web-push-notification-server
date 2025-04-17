// Service Worker for Push Notifications

self.addEventListener('push', (event) => {
	console.log('[Service Worker] Push Received');

	let notificationData = {};

	try {
		notificationData = event.data.json();
	} catch (e) {
		notificationData = {
			notification: {
				title: 'New Notification',
				body: event.data ? event.data.text() : 'No payload',
				icon: 'https://via.placeholder.com/128'
			}
		};
	}

	const options = notificationData.notification;

	event.waitUntil(self.registration.showNotification(options.title, options));
});

self.addEventListener('notificationclick', (event) => {
	console.log('[Service Worker] Notification click received');

	event.notification.close();

	// You can handle clicks differently based on event.notification.data
	// or event.action (for action buttons)
	if (event.action === 'explore') {
		// Handle "explore" action click
		console.log('Explore action clicked');
	} else {
		// Handle notification click
		console.log('Notification clicked');
	}

	// This will open a window/tab with the specified URL
	// You can customize this to navigate to different URLs
	// event.waitUntil(
	//   clients.openWindow('https://example.com')
	// );
});
