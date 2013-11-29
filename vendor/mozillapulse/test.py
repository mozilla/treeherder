import json
from mozillapulse.consumers import CodeConsumer

def onmessage(data, message):
    message.ack()
    print json.dumps(data, indent=2)

if __name__ == "__main__":
    pulse = CodeConsumer(applabel='codetest')
    pulse.configure(topic="#",
                    callback=onmessage,
                    durable=False)
    pulse.listen()
