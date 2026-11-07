def depth_first_search(graph, start_node=None):
    if not graph:
        return []
    if start_node is None:
        start_node = next(iter(graph))
    if start_node not in graph:
        return []
    visited = []
    order = []

    def dfs(node):
        visited.append(node)
        order.append(node)
        for neighbor in graph[node]:
            if neighbor not in visited:
                dfs(neighbor)

    dfs(start_node)
    return order