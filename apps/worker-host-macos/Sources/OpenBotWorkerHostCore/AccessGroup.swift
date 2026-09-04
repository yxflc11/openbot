import Foundation
import Security

public enum MacOSAccessGroup {
    public static let suffix = ".com.openbot.worker-host.shared"

    public static func select(from groups: [String]) throws -> String {
        let matches = groups.filter { group in
            guard group.hasSuffix(suffix) else { return false }
            let prefix = String(group.dropLast(suffix.count))
            return prefix.count == 10 &&
                prefix.range(of: #"^[A-Z0-9]{10}$"#, options: .regularExpression) != nil
        }
        guard matches.count == 1, Set(groups).count == groups.count else {
            throw OpenBotMacOSError.invalidAccessGroup
        }
        return matches[0]
    }

    public static func current() throws -> String {
        guard let task = SecTaskCreateFromSelf(nil),
              let value = SecTaskCopyValueForEntitlement(
                  task,
                  "keychain-access-groups" as CFString,
                  nil
              ) as? [String]
        else {
            throw OpenBotMacOSError.invalidAccessGroup
        }
        return try select(from: value)
    }
}
