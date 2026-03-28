const { EventEmitter } = require("events");

const liveDeliveryHub = new EventEmitter();
liveDeliveryHub.setMaxListeners(100);

function publishLiveEvent(event) {
  liveDeliveryHub.emit("event", {
    ...event,
    emitted_at: new Date().toISOString(),
  });
}

function subscribeLiveEvents(listener) {
  liveDeliveryHub.on("event", listener);
  return () => liveDeliveryHub.off("event", listener);
}

module.exports = {
  publishLiveEvent,
  subscribeLiveEvents,
};
