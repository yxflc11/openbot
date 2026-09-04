import Foundation

public protocol NodeEnrollmentClient: Sendable {
    func exchange(nodeId: String, serverUrl: String, token: String) async throws -> NodeIdentity
}

public struct URLSessionNodeEnrollmentClient: NodeEnrollmentClient, Sendable {
    public static let maximumResponseBytes = 8 * 1024

    public init() {}

    public func exchange(nodeId: String, serverUrl: String, token: String) async throws -> NodeIdentity {
        guard isValidEnrollmentToken(token) else {
            throw OpenBotMacOSError.enrollmentFailure
        }
        let configuration = try MacOSNodeConfiguration(nodeId: nodeId, serverUrl: serverUrl)
        let endpoint = try enrollmentEndpoint(for: serverUrl)
        let requestBody = try JSONSerialization.data(
            withJSONObject: ["nodeId": nodeId, "token": token],
            options: [.sortedKeys]
        )
        guard requestBody.count <= Self.maximumResponseBytes else {
            throw OpenBotMacOSError.enrollmentFailure
        }

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 10
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = requestBody

        do {
            let (bytes, response) = try await URLSession.shared.bytes(for: request)
            guard let http = response as? HTTPURLResponse,
                  http.statusCode == 201,
                  http.value(forHTTPHeaderField: "Content-Type")?.lowercased().hasPrefix("application/json") == true
            else {
                bytes.task.cancel()
                throw OpenBotMacOSError.enrollmentFailure
            }
            var data = Data()
            data.reserveCapacity(512)
            for try await byte in bytes {
                if data.count >= Self.maximumResponseBytes {
                    bytes.task.cancel()
                    throw OpenBotMacOSError.enrollmentFailure
                }
                data.append(byte)
            }
            let identity = try NodeIdentity.decodeStrict(data)
            guard identity.nodeId == configuration.nodeId else {
                throw OpenBotMacOSError.enrollmentFailure
            }
            return identity
        } catch {
            throw OpenBotMacOSError.enrollmentFailure
        }
    }
}
