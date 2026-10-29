import MixinStorage "blob-storage/Mixin";
import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Text "mo:base/Text";
import Iter "mo:base/Iter";

actor {
  include MixinStorage();

  stable var calendarLinkedEntries : [(Principal, Bool)] = [];
  stable var taskEventEntries : [(Text, Text)] = [];

  let calendarLinked = HashMap.HashMap<Principal, Bool>(8, Principal.equal, Principal.hash);
  let taskEvents = HashMap.HashMap<Text, Text>(16, Text.equal, Text.hash);

  system func postupgrade() {
    for ((principal, linked) in calendarLinkedEntries.vals()) {
      calendarLinked.put(principal, linked);
    };
    for ((taskId, eventId) in taskEventEntries.vals()) {
      taskEvents.put(taskId, eventId);
    };
    calendarLinkedEntries := [];
    taskEventEntries := [];
  };

  system func preupgrade() {
    calendarLinkedEntries := Iter.toArray(calendarLinked.entries());
    taskEventEntries := Iter.toArray(taskEvents.entries());
  };

  /// Persists whether the caller has granted Google Calendar linking.
  /// We keep only a boolean on-chain and never store OAuth tokens.
  public shared ({ caller }) func setCalendarLinked(linked : Bool) : async () {
    calendarLinked.put(caller, linked);
  };

  /// Returns whether the caller has linked Google Calendar scopes.
  public query ({ caller }) func getCalendarLinked() : async Bool {
    switch (calendarLinked.get(caller)) {
      case (?value) { value };
      case null { false };
    };
  };

  /// Stores a task-to-Google-event reference for reconciliation and retries.
  /// This avoids "zombie" UI states when frontend sync partially fails.
  public shared ({ caller }) func recordGoogleEventLink(taskId : Text, googleEventId : Text) : async () {
    // Namespace by caller principal to prevent cross-user collisions.
    let key = Principal.toText(caller) # ":" # taskId;
    taskEvents.put(key, googleEventId);
  };

  /// Returns the previously persisted Google event id for a task, if available.
  public query ({ caller }) func getGoogleEventLink(taskId : Text) : async ?Text {
    let key = Principal.toText(caller) # ":" # taskId;
    taskEvents.get(key);
  };

  public shared ({ caller }) func triggerDapps() : async () {};
};
