// Service Worker registration
let swRegistration = null;
let isSubscribed = false;
let vapidPublicKey = null;

const subscribeButton = document.getElementById('subscribe-button');
const statusElement = document.getElementById('subscription-status');
const notificationForm = document.getElementById('notification-form');

// Check if service workers and push messaging are supported by the browser
function checkBrowserSupport() {
	if ('serviceWorker' in navigator && 'PushManager' in window) {
		console.log('Service Worker and Push are supported');
		return true;
	} else {
		statusElement.textContent =
			'Push notifications are not supported by your browser';
		statusElement.className = 'status error';
		subscribeButton.disabled = true;
		return false;
	}
}

// Initialize the app
window.addEventListener('load', async () => {
	if (!checkBrowserSupport()) return;

	try {
		// Register service worker
		swRegistration = await navigator.serviceWorker.register(
			'/js/service-worker.js'
		);
		console.log('Service Worker registered:', swRegistration);

		// Get VAPID public key from server
		const response = await fetch('/vapid-public-key');
		const data = await response.json();
		vapidPublicKey = data.publicKey;

		// Check if user is already subscribed
		initializeUI();
	} catch (error) {
		console.error('Service Worker registration failed:', error);
		statusElement.textContent = 'Service Worker registration failed';
		statusElement.className = 'status error';
	}
});

// Initialize UI based on subscription status
async function initializeUI() {
	try {
		const subscription = await swRegistration.pushManager.getSubscription();
		isSubscribed = !(subscription === null);

		if (isSubscribed) {
			console.log('User is subscribed to push notifications');
			subscribeButton.textContent = 'Disable Notifications';
			statusElement.textContent = 'Push notifications are enabled';
			statusElement.className = 'status success';
		} else {
			console.log('User is not subscribed to push notifications');
			subscribeButton.textContent = 'Enable Notifications';
			statusElement.textContent = 'Push notifications are disabled';
			statusElement.className = 'status';
		}

		subscribeButton.disabled = false;
	} catch (error) {
		console.error('Error during initialization:', error);
	}
}

// Subscribe to push notifications
async function subscribeUser() {
	try {
		// Convert base64 string to Uint8Array
		const applicationServerKey = urlB64ToUint8Array(vapidPublicKey);

		const subscription = await swRegistration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: applicationServerKey
		});

		console.log('User is subscribed:', subscription);

		// Send subscription to server
		await fetch('/subscribe', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(subscription)
		});

		isSubscribed = true;
		updateSubscriptionUI();
	} catch (error) {
		console.error('Failed to subscribe the user:', error);
		statusElement.textContent = 'Failed to subscribe to notifications';
		statusElement.className = 'status error';
	}
}

// Unsubscribe from push notifications
async function unsubscribeUser() {
	try {
		const subscription = await swRegistration.pushManager.getSubscription();

		if (subscription) {
			await subscription.unsubscribe();
			console.log('User is unsubscribed');
			isSubscribed = false;
			updateSubscriptionUI();
		}
	} catch (error) {
		console.error('Error unsubscribing:', error);
		statusElement.textContent = 'Error unsubscribing from notifications';
		statusElement.className = 'status error';
	}
}

// Update UI based on subscription status
function updateSubscriptionUI() {
	if (isSubscribed) {
		subscribeButton.textContent = 'Disable Notifications';
		statusElement.textContent = 'Push notifications are enabled';
		statusElement.className = 'status success';
	} else {
		subscribeButton.textContent = 'Enable Notifications';
		statusElement.textContent = 'Push notifications are disabled';
		statusElement.className = 'status';
	}
}

// Handle subscribe/unsubscribe button click
subscribeButton.addEventListener('click', async () => {
	subscribeButton.disabled = true;

	if (isSubscribed) {
		await unsubscribeUser();
	} else {
		await subscribeUser();
	}

	subscribeButton.disabled = false;
});

// Send test notification
notificationForm.addEventListener('submit', async (event) => {
	event.preventDefault();

	const title = document.getElementById('title').value;
	const body = document.getElementById('body').value;

	try {
		const response = await fetch('/send-notification', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ title, body })
		});

		const data = await response.json();
		console.log('Notification sent:', data);

		alert('Notification sent successfully!');
	} catch (error) {
		console.error('Error sending notification:', error);
		alert('Failed to send notification. See console for details.');
	}
});

// Utility function to convert base64 string to Uint8Array for the applicationServerKey
function urlB64ToUint8Array(base64String) {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding)
		.replace(/\-/g, '+')
		.replace(/_/g, '/');

	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);

	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}
