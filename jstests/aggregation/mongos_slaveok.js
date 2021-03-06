/**
 * Tests aggregate command against mongos with slaveOk. For more tests on read preference,
 * please refer to jstests/sharding/read_pref_cmd.js.
 */

var NODES = 2;

var doTest = function(st, doSharded) {
var testDB = st.s.getDB('test');

if (doSharded) {
    testDB.adminCommand({ enableSharding: 'test' });
    testDB.adminCommand({ shardCollection: 'test.user', key: { x: 1 }});
}

testDB.user.insert({ x: 10 });
testDB.runCommand({ getLastError: 1, w: NODES });
sleep(2000); // wait for secondary application

testDB.setSlaveOk(true);

var secNode = st.rs0.getSecondary();
secNode.getDB('test').setProfilingLevel(2);

var res = testDB.runCommand({ aggregate: 'user', pipeline: [{ $project: { x: 1 }}]});
assert(res.ok, 'aggregate command failed: ' + tojson(res));

var profileQuery = { op: 'command', ns: 'test.$cmd', 'command.aggregate': 'user' };
var profileDoc = secNode.getDB('test').system.profile.findOne(profileQuery);

assert(profileDoc != null);
testDB.dropDatabase();
};

var st = new ShardingTest({ shards: { rs0: { oplogSize: 10, verbose: 1, nodes: NODES }}});

doTest(st, false);
doTest(st, true);

st.stop();
