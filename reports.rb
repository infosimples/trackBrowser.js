REPORTS_DIR = ARGV[0]
require 'json'
require 'csv'

# Analyze paths
tree = {}
info = {}

File.open("#{REPORTS_DIR}/log.jsonl").each do |line|
  json = JSON.parse(line)
  if (path = json['path']).to_s.size > 0
    info[path] ||= {'event' => [], 'typeof' => [], 'return' => [], 'value' => []}
    info[path]['event']  << json['event'] if json.has_key?('event')
    info[path]['typeof'] << json['typeof'] if json.has_key?('typeof')
    info[path]['return'] << json['return'] if json.has_key?('return')
    info[path]['value']  << json['value'] if json.has_key?('value')

    node = tree
    path.split('.').each { |key| node = (node[key] ||= {}) }
  end
end

def deepest_paths(path, node)
  node.any? ? node.map { |k, v| deepest_paths("#{path}.#{k}", v) } : path
end
paths = deepest_paths('window', tree['window']).flatten.uniq.sort

csv = CSV.open("#{REPORTS_DIR}/paths.csv", 'w')
csv << ['path', 'occurences', 'events', 'typeof', 'return (get)', 'value (set)']
paths.each do |path|
  row = []
  row << path
  row << info[path]['event'].count
  row << JSON.dump(info[path]['event'].uniq)
  row << JSON.dump(info[path]['typeof'].uniq)
  row << JSON.dump(info[path]['return'].uniq)
  row << JSON.dump(info[path]['value'].uniq)
  csv << row
end
csv.close
