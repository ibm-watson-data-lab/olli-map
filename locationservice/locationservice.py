import os, json, time, requests

segments = []
# order is important in these file names
# this is the order in which they will "play back"
fileNames = ['./segments/route3a.json', './segments/route3b.json', './segments/route3c.json', './segments/route3d.json', './segments/route3e.json']
dburi = os.environ['CLOUDANT_URL']
print(dburi)

def readfiles():
  for fi in fileNames: 
    with open(fi) as stuff:
      geoj = json.load(stuff)
      # print geoj["features"][0]["properties"]
      segments.append(geoj)

def sendLocation(feature):
  feature["properties"]["ts"] = int(round(time.time() * 1000))
  print "Sending location..."+str(feature)
  requests.post(dburi, json=feature)
  time.sleep(1) # send a point every second


# delete database and re-create
print "Deleting database..."
r = requests.delete(dburi)
print r.status_code

r = requests.put(dburi)
print r.status_code
if r.status_code == 201: 
  print "Database created successfully"

readfiles()

counter = 0
while counter < 100: 
  for segment in segments:
    features = segment["features"]
    for feature in features:
      sendLocation(feature)
    time.sleep(5)
    counter = counter + 1