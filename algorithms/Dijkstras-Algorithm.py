import heapq

def dijkstras_algorithm(graph, start_node=None):
    if not graph:
        return {}
    if start_node is None:
        start_node = next(iter(graph))
    if start_node not in graph:
        return {}

    distances = {node: float('inf') for node in graph}
    distances[start_node] = 0
    parent = {node: None for node in graph}
    pq = [(0, start_node)]
    visited = set()

    while pq:
        current_distance, node = heapq.heappop(pq)
        if node in visited:
            continue
        visited.add(node)

        for neighbor, weight in graph[node]:
            distance = current_distance + weight
            if distance < distances[neighbor]:
                distances[neighbor] = distance
                parent[neighbor] = node
                heapq.heappush(pq, (distance, neighbor))

    return distances